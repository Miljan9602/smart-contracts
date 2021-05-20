const {
    address,
    encodeParameters
} = require('./ethereum');
const configuration = require('../deployments/deploymentConfig.json');
const { ethers, expect, isEthException, awaitTx, toHordDenomination, waitForSomeTime, BigNumber } = require('./setup')
const hre = require("hardhat");


let hordCongress, hordCongressAddress, accounts, owner, ownerAddr, alice, aliceAddress, bob, bobAddress, maintainer, maintainerAddr,
    config,
    hordToken, keyToken, maintainersRegistryContract, ticketManagerReserveContract;

async function setupAccounts () {
    config = configuration[hre.network.name];
    let accounts = await ethers.getSigners()
    owner = accounts[0];
    ownerAddr = await owner.getAddress();

    // Mock hord congress
    hordCongress = accounts[7];
    hordCongressAddress = await hordCongress.getAddress();
    // Mock maintainer address
    maintainer = accounts[8];
    maintainerAddr = await maintainer.getAddress();

    alice = accounts[9];
    aliceAddress = await alice.getAddress();

    bob = accounts[10];
    bobAddress = await bob.getAddress();
}

async function setupContracts () {
    const Hord = await hre.ethers.getContractFactory("HordToken");

    hordToken = await Hord.deploy(
        config.hordTokenName,
        config.hordTokenSymbol,
        toHordDenomination(config.hordTotalSupply.toString()),
        ownerAddr
    );
    await hordToken.deployed()

    hordToken = hordToken.connect(owner)

    keyToken = await Hord.deploy(
        "KEY Token",
        "KEY",
        toHordDenomination(config.hordTotalSupply.toString()),
        ownerAddr
    );
    await keyToken.deployed()

    keyToken = keyToken.connect(owner)


    const MaintainersRegistry = await ethers.getContractFactory('MaintainersRegistry')
    const maintainersRegistry = await upgrades.deployProxy(MaintainersRegistry, [[maintainerAddr], hordCongressAddress]);
    await maintainersRegistry.deployed()
    maintainersRegistryContract = maintainersRegistry.connect(owner);


    const HordTicketManager = await ethers.getContractFactory('HordTicketManager');
    const hordTicketManager = await upgrades.deployProxy(HordTicketManager, [
            hordCongressAddress,
            maintainersRegistry.address,
            hordToken.address,
            config['minTimeToStake'],
            toHordDenomination(config['minAmountToStake'])
        ]
    );
    await hordTicketManager.deployed()
    ticketManagerContract = hordTicketManager.connect(owner);

    const HordTicketFactory = await ethers.getContractFactory('HordTicketFactory')
    const hordTicketFactory = await upgrades.deployProxy(HordTicketFactory, [
            hordCongressAddress,
            maintainersRegistry.address,
            hordTicketManager.address,
            config["maxFungibleTicketsPerPool"],
            config["uri"]
        ]
    );
    await hordTicketFactory.deployed()

    ticketFactoryContract = hordTicketFactory.connect(maintainer);

    supplyToMint = 20;

    await hordTicketManager.setHordTicketFactory(hordTicketFactory.address);

    const TicketManagerReserve = await ethers.getContractFactory('TicketManagerReserve');
    const ticketManagerReserve = await upgrades.deployProxy(TicketManagerReserve, [
        hordCongressAddress,
        maintainersRegistry.address
    ]);
    await ticketManagerReserve.deployed()
    ticketManagerReserveContract = ticketManagerReserve.connect(owner);
}

describe('HordTicketFactory & HordTicketManager Test', () => {
    before('setup contracts', async () => {
        await setupAccounts();
        await setupContracts()
    });

    describe('Deposit and Withdraw ERC20 tokens', async() => {
        it('shoud NOT withdraw from the contract with zero token amount', async() => {
            ticketManagerReserveContract = ticketManagerReserveContract.connect(hordCongress);
            await expect(ticketManagerReserveContract.withdrawToken(ownerAddr, hordToken.address, toHordDenomination(10)))
            .to.be.revertedWith("TicketManagerReserve: Insufficient balance");
        });

        it('shoud NOT withdraw to the same contract', async() => {
            ticketManagerReserveContract = ticketManagerReserveContract.connect(hordCongress);
            await expect(ticketManagerReserveContract.withdrawToken(ticketManagerReserveContract.address, hordToken.address, toHordDenomination(10)))
            .to.be.revertedWith("TicketManagerReserve: Can not withdraw to TicketManagerReserve contract");
        });

        it('shoud deposit HORD ERC20 token', async() => {
            // Transfer HORD ERC20 token to alice and bob
            hordToken.connect(owner).transfer(aliceAddress, toHordDenomination(100));
            hordToken.connect(owner).transfer(bobAddress, toHordDenomination(100));

            // Approve HORD ERC20 token
            hordToken.connect(alice).approve(ticketManagerReserveContract.address, toHordDenomination(10));
            hordToken.connect(bob).approve(ticketManagerReserveContract.address, toHordDenomination(10));

            // Deposit HORD ERC20 tokesn
            await ticketManagerReserveContract.connect(alice).depositToken(hordToken.address, toHordDenomination(10));
            let tokenBalance = await ticketManagerReserveContract.getTokenBalance(hordToken.address)
            expect(tokenBalance).to.be.equal(toHordDenomination(10));

            await ticketManagerReserveContract.connect(bob).depositToken(hordToken.address, toHordDenomination(10));
            tokenBalance = await ticketManagerReserveContract.getTokenBalance(hordToken.address)
            expect(tokenBalance).to.be.equal(toHordDenomination(20));


            // Transfer KEY ERC20 token to alice and bob
            keyToken.connect(owner).transfer(aliceAddress, toHordDenomination(100));
            keyToken.connect(owner).transfer(bobAddress, toHordDenomination(100));

            // Approve KEY ERC20 token
            keyToken.connect(alice).approve(ticketManagerReserveContract.address, toHordDenomination(10));
            keyToken.connect(bob).approve(ticketManagerReserveContract.address, toHordDenomination(10));
            
            // Deposit KEY ERC20 tokesn
            await ticketManagerReserveContract.connect(alice).depositToken(keyToken.address, toHordDenomination(10));
            tokenBalance = await ticketManagerReserveContract.getTokenBalance(keyToken.address)
            expect(tokenBalance).to.be.equal(toHordDenomination(10));

            await ticketManagerReserveContract.connect(bob).depositToken(keyToken.address, toHordDenomination(10));
            tokenBalance = await ticketManagerReserveContract.getTokenBalance(keyToken.address)
            expect(tokenBalance).to.be.equal(toHordDenomination(20));
            
        });

        it('shoud NOT be withdrawn ERC20 token by non-congress address', async() => {           
            await expect(ticketManagerReserveContract.connect(owner).withdrawToken(aliceAddress, hordToken.address, toHordDenomination(1)))
            .to.be.revertedWith("HordUpgradable: Restricted only to HordCongress");
        });

        it('shoud withdraw ERC20 token', async() => {          
            // Withdraw Hord ERC20 token
            await ticketManagerReserveContract.connect(hordCongress).withdrawToken(aliceAddress, hordToken.address, toHordDenomination(1));

            let tokenBalance = await ticketManagerReserveContract.getTokenBalance(hordToken.address)
            expect(tokenBalance).to.be.equal(toHordDenomination(19));

            tokenBalance = await hordToken.balanceOf(aliceAddress);
            expect(tokenBalance).to.be.equal(toHordDenomination(91));

            // Withdraw KEY ERC20 token
            await ticketManagerReserveContract.connect(hordCongress).withdrawToken(aliceAddress, keyToken.address, toHordDenomination(10));

            tokenBalance = await ticketManagerReserveContract.getTokenBalance(keyToken.address)
            expect(tokenBalance).to.be.equal(toHordDenomination(10));

            tokenBalance = await keyToken.balanceOf(aliceAddress);
            expect(tokenBalance).to.be.equal(toHordDenomination(100));
        });
    });

    describe('Deposit and Withdraw Ether', async() => {
        it('shoud NOT withdraw from the contract with zero token amount', async() => {
            ticketManagerReserveContract = ticketManagerReserveContract.connect(hordCongress);
            await expect(ticketManagerReserveContract.withdrawEther(aliceAddress, toHordDenomination(10)))
            .to.be.revertedWith("TicketManagerReserve: Failed to send Ether");
        });

        it('shoud NOT withdraw to the same contract', async() => {
            ticketManagerReserveContract = ticketManagerReserveContract.connect(hordCongress);
            await expect(ticketManagerReserveContract.withdrawEther(ticketManagerReserveContract.address, toHordDenomination(10)))
            .to.be.revertedWith("TicketManagerReserve: Can not withdraw to TicketManagerReserve contract");
        });

        it('shoud deposit Ether', async() => {
            const tx = await alice.sendTransaction({
                to: ticketManagerReserveContract.address,
                value: ethers.utils.parseEther("1")
            });
            let ethBalance = await ticketManagerReserveContract.getEtherBalance();
            expect(ethBalance).to.be.equal(ethers.utils.parseEther("1"));
        });

        it('shoud NOT withdraw Ether by non-congress address', async() => {           
            await expect(ticketManagerReserveContract.connect(owner).withdrawEther(aliceAddress, ethers.utils.parseEther("0.1")))
            .to.be.revertedWith("HordUpgradable: Restricted only to HordCongress");
        });

        it('shoud withdraw Ether', async() => {          
            let oldContractEthBalance = await ticketManagerReserveContract.getEtherBalance();
            let oldBobEthBalance = await bob.getBalance();

            await ticketManagerReserveContract.connect(hordCongress).withdrawEther(bobAddress, ethers.utils.parseEther("0.1"));
            
            let newEthBalance = await ticketManagerReserveContract.getEtherBalance();
            let newBobEthBalance = await bob.getBalance();

            expect(new BigNumber.from(oldContractEthBalance).sub(new BigNumber.from(newEthBalance))).to.be.equal(ethers.utils.parseEther("0.1"));
            expect(new BigNumber.from(newBobEthBalance).sub(new BigNumber.from(oldBobEthBalance))).to.be.equal(ethers.utils.parseEther("0.1"));
        });
    });
});
