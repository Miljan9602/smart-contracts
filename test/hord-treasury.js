const {
    address,
    encodeParameters
} = require('./ethereum');
const configuration = require('../deployments/deploymentConfig.json');
const { ethers, expect, isEthException, awaitTx, toHordDenomination, waitForSomeTime, BigNumber } = require('./setup')
const hre = require("hardhat");


let hordCongress, hordCongressAddress, accounts, owner, ownerAddr, alice, aliceAddress, bob, bobAddress, maintainer, maintainerAddr,
    config,
    hordToken, keyToken, maintainersRegistryContract, hordTreasuryContract;

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

    bob = accounts[5];
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


    const HordTreasury = await ethers.getContractFactory('HordTreasury');
    const hordTreasury = await upgrades.deployProxy(HordTreasury, [
        hordCongressAddress,
        maintainersRegistry.address
    ]);
    await hordTreasury.deployed()
    hordTreasuryContract = hordTreasury.connect(owner);
}

describe('HordTreasury Test', () => {
    before('setup contracts', async () => {
        await setupAccounts();
        await setupContracts()
    });

    describe('Deposit and Withdraw ERC20 tokens', async() => {
        it('shoud NOT withdraw from the contract with zero token amount', async() => {
            hordTreasuryContract = hordTreasuryContract.connect(hordCongress);
            await expect(hordTreasuryContract.withdrawToken(ownerAddr, hordToken.address, toHordDenomination(10)))
            .to.be.revertedWith("HordTreasury: Insufficient balance");
        });

        it('should NOT withdraw to the same contract', async() => {
            hordTreasuryContract = hordTreasuryContract.connect(hordCongress);
            await expect(hordTreasuryContract.withdrawToken(hordTreasuryContract.address, hordToken.address, toHordDenomination(10)))
            .to.be.revertedWith("HordTreasury: Can not withdraw to HordTreasury contract");
        });

        it('should deposit HORD ERC20 token', async() => {
            // Transfer HORD ERC20 token to alice and bob
            await hordToken.connect(owner).transfer(aliceAddress, toHordDenomination(100));
            await hordToken.connect(owner).transfer(bobAddress, toHordDenomination(100));

            // Approve HORD ERC20 token
            await hordToken.connect(alice).approve(hordTreasuryContract.address, toHordDenomination(10));
            await hordToken.connect(bob).approve(hordTreasuryContract.address, toHordDenomination(10));

            // Deposit HORD ERC20 tokens
            await hordTreasuryContract.connect(alice).depositToken(hordToken.address, toHordDenomination(10));
            let tokenBalance = await hordTreasuryContract.getTokenBalance(hordToken.address)
            expect(tokenBalance).to.be.equal(toHordDenomination(10));

            await hordTreasuryContract.connect(bob).depositToken(hordToken.address, toHordDenomination(10));
            tokenBalance = await hordTreasuryContract.getTokenBalance(hordToken.address)
            expect(tokenBalance).to.be.equal(toHordDenomination(20));


            // Transfer KEY ERC20 token to alice and bob
            await keyToken.connect(owner).transfer(aliceAddress, toHordDenomination(100));
            await keyToken.connect(owner).transfer(bobAddress, toHordDenomination(100));

            // Approve KEY ERC20 token
            await keyToken.connect(alice).approve(hordTreasuryContract.address, toHordDenomination(10));
            await keyToken.connect(bob).approve(hordTreasuryContract.address, toHordDenomination(10));

            // Deposit KEY ERC20 tokens
            await hordTreasuryContract.connect(alice).depositToken(keyToken.address, toHordDenomination(10));
            tokenBalance = await hordTreasuryContract.getTokenBalance(keyToken.address)
            expect(tokenBalance).to.be.equal(toHordDenomination(10));

            await hordTreasuryContract.connect(bob).depositToken(keyToken.address, toHordDenomination(10));
            tokenBalance = await hordTreasuryContract.getTokenBalance(keyToken.address)
            expect(tokenBalance).to.be.equal(toHordDenomination(20));

        });

        it('should NOT be withdrawn ERC20 token by non-congress address', async() => {
            await expect(hordTreasuryContract.connect(owner).withdrawToken(aliceAddress, hordToken.address, toHordDenomination(1)))
            .to.be.revertedWith("HordUpgradable: Restricted only to HordCongress");
        });

        it('should withdraw ERC20 token', async() => {
            // Withdraw Hord ERC20 token
            await hordTreasuryContract.connect(hordCongress).withdrawToken(aliceAddress, hordToken.address, toHordDenomination(1));

            let tokenBalance = await hordTreasuryContract.getTokenBalance(hordToken.address)
            expect(tokenBalance).to.be.equal(toHordDenomination(19));

            tokenBalance = await hordToken.balanceOf(aliceAddress);
            expect(tokenBalance).to.be.equal(toHordDenomination(91));

            // Withdraw KEY ERC20 token
            await hordTreasuryContract.connect(hordCongress).withdrawToken(aliceAddress, keyToken.address, toHordDenomination(10));

            tokenBalance = await hordTreasuryContract.getTokenBalance(keyToken.address)
            expect(tokenBalance).to.be.equal(toHordDenomination(10));

            tokenBalance = await keyToken.balanceOf(aliceAddress);
            expect(tokenBalance).to.be.equal(toHordDenomination(100));
        });

        it('should totalTokenWithdrawn is properly updated', async() => {

            let tknBalance = await hordTreasuryContract.totalTokenWithdrawn(hordToken.address);

            expect(await hordTreasuryContract.connect(hordCongress).withdrawToken(aliceAddress, hordToken.address, toHordDenomination(10)))
                .to.emit(hordTreasuryContract, "WithdrawToken")
                .withArgs(aliceAddress, hordToken.address, toHordDenomination(10));

            const resp = await hordTreasuryContract.totalTokenWithdrawn(hordToken.address);
            expect(new BigNumber.from(tknBalance).add(toHordDenomination(10))).to.be.equal(resp);

        });

    });

    describe('Deposit and Withdraw Ether', async() => {

        it('should NOT withdraw from the contract with zero token amount', async() => {
            hordTreasuryContract = hordTreasuryContract.connect(hordCongress);
            await expect(hordTreasuryContract.withdrawEther(aliceAddress, toHordDenomination(10)))
            .to.be.revertedWith("HordTreasury: Failed to send Ether");
        });

        it('should NOT withdraw to the same contract', async() => {
            hordTreasuryContract = hordTreasuryContract.connect(hordCongress);
            await expect(hordTreasuryContract.withdrawEther(hordTreasuryContract.address, toHordDenomination(10)))
            .to.be.revertedWith("HordTreasury: Can not withdraw to HordTreasury contract");
        });

        it('should deposit Ether', async() => {
            const tx = await alice.sendTransaction({
                to: hordTreasuryContract.address,
                value: ethers.utils.parseEther("1")
            });
            let ethBalance = await hordTreasuryContract.getEtherBalance();
            expect(ethBalance).to.be.equal(ethers.utils.parseEther("1"));
        });


        it('should totalETHWithdrawn is properly updated', async() => {

            await bob.sendTransaction({
                to: hordTreasuryContract.address,
                value: ethers.utils.parseEther("5")
            });

            let ethBalance = await hordTreasuryContract.totalETHWithdrawn();

            expect(await hordTreasuryContract.connect(hordCongress).withdrawEther(aliceAddress, ethers.utils.parseEther("1")))
                .to.emit(hordTreasuryContract,"WithdrawEther")
                .withArgs(aliceAddress, ethers.utils.parseEther("1"));

            const resp = await hordTreasuryContract.totalETHWithdrawn();
            expect(resp).to.be.equal(new BigNumber.from(ethBalance).add(ethers.utils.parseEther("1")));

        });

        it('should totalETHReceived is properly updated', async() => {

            let ethBalance = await hordTreasuryContract.totalETHReceived();

            await bob.sendTransaction({
                to: hordTreasuryContract.address,
                value: ethers.utils.parseEther("0.000005")
            });

            const resp = await hordTreasuryContract.totalETHReceived();
            expect(new BigNumber.from(ethBalance).add(ethers.utils.parseEther("0.000005"))).to.be.equal(resp);

        });

        it('should NOT withdraw Ether by non-congress address', async() => {
            await expect(hordTreasuryContract.connect(owner).withdrawEther(aliceAddress, ethers.utils.parseEther("0.1")))
            .to.be.revertedWith("HordUpgradable: Restricted only to HordCongress");
        });

        it('should withdraw Ether', async() => {
            let oldContractEthBalance = await hordTreasuryContract.getEtherBalance();
            let oldBobEthBalance = await bob.getBalance();

            await hordTreasuryContract.connect(hordCongress).withdrawEther(bobAddress, ethers.utils.parseEther("0.1"));

            let newEthBalance = await hordTreasuryContract.getEtherBalance();
            let newBobEthBalance = await bob.getBalance();

            expect(new BigNumber.from(oldContractEthBalance).sub(new BigNumber.from(newEthBalance))).to.be.equal(ethers.utils.parseEther("0.1"));
            expect(new BigNumber.from(newBobEthBalance).sub(new BigNumber.from(oldBobEthBalance))).to.be.equal(ethers.utils.parseEther("0.1"));
        });
    });
});
