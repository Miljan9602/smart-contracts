const {
    address,
    encodeParameters
} = require('./ethereum');
const configuration = require('../deployments/deploymentConfig.json');
const { ethers, expect, isEthException, awaitTx, toHordDenomination, waitForSomeTime, BigNumber } = require('./setup')
const hre = require("hardhat");


let hordCongress, hordCongressAddress, accounts, owner, ownerAddr, alice, aliceAddress, bob, bobAddress, maintainer, maintainerAddr,
    config,
    hordToken, keyToken, maintainersRegistryContract, hordTreasuryContract, tokenBalanceBefore, tokenBalanceAfter,
    etherBalanceBefore, etherBalanceAfter;

const tokenTransferAmount = 100;
const tokenCheckAmount = 10;
const depositCheckAmount = 20;
const withdrawTokenValue = 1;

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
    const maintainersRegistry = await MaintainersRegistry.deploy();
    await maintainersRegistry.deployed()
    await maintainersRegistry.initialize(
        [maintainerAddr], hordCongressAddress
    );
    maintainersRegistryContract = maintainersRegistry.connect(owner);


    const HordTreasury = await ethers.getContractFactory('HordTreasury');
    const hordTreasury = await HordTreasury.deploy();
    await hordTreasury.deployed();

    await hordTreasury.initialize(
        hordCongressAddress,
        maintainersRegistry.address
    );

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
            await expect(hordTreasuryContract.withdrawToken(ownerAddr, hordToken.address, toHordDenomination(tokenCheckAmount)))
            .to.be.revertedWith("HordTreasury: Insufficient balance");
        });

        it('should NOT withdraw to the same contract', async() => {
            hordTreasuryContract = hordTreasuryContract.connect(hordCongress);
            await expect(hordTreasuryContract.withdrawToken(hordTreasuryContract.address, hordToken.address, toHordDenomination(tokenCheckAmount)))
            .to.be.revertedWith("HordTreasury: Can not withdraw to HordTreasury contract");
        });

        it('should deposit HORD ERC20 token', async() => {
            // Transfer HORD ERC20 token to alice and bob
            await hordToken.connect(owner).transfer(aliceAddress, toHordDenomination(tokenTransferAmount));
            await hordToken.connect(owner).transfer(bobAddress, toHordDenomination(tokenTransferAmount));

            // Approve HORD ERC20 token
            await hordToken.connect(alice).approve(hordTreasuryContract.address, toHordDenomination(tokenCheckAmount));
            await hordToken.connect(bob).approve(hordTreasuryContract.address, toHordDenomination(tokenCheckAmount));

            // Deposit HORD ERC20 tokens
            await hordTreasuryContract.connect(alice).depositToken(hordToken.address, toHordDenomination(tokenCheckAmount));
            let tokenBalance = await hordTreasuryContract.getTokenBalance(hordToken.address)
            expect(tokenBalance).to.be.equal(toHordDenomination(tokenCheckAmount));

            await hordTreasuryContract.connect(bob).depositToken(hordToken.address, toHordDenomination(tokenCheckAmount));
            tokenBalance = await hordTreasuryContract.getTokenBalance(hordToken.address)
            expect(tokenBalance).to.be.equal(toHordDenomination(depositCheckAmount));


            // Transfer KEY ERC20 token to alice and bob
            await keyToken.connect(owner).transfer(aliceAddress, toHordDenomination(tokenTransferAmount));
            await keyToken.connect(owner).transfer(bobAddress, toHordDenomination(tokenTransferAmount));

            // Approve KEY ERC20 token
            await keyToken.connect(alice).approve(hordTreasuryContract.address, toHordDenomination(tokenCheckAmount));
            await keyToken.connect(bob).approve(hordTreasuryContract.address, toHordDenomination(tokenCheckAmount));

            // Deposit KEY ERC20 tokens
            await hordTreasuryContract.connect(alice).depositToken(keyToken.address, toHordDenomination(tokenCheckAmount));
            tokenBalance = await hordTreasuryContract.getTokenBalance(keyToken.address)
            expect(tokenBalance).to.be.equal(toHordDenomination(tokenCheckAmount));

            await hordTreasuryContract.connect(bob).depositToken(keyToken.address, toHordDenomination(tokenCheckAmount));
            tokenBalance = await hordTreasuryContract.getTokenBalance(keyToken.address)
            expect(tokenBalance).to.be.equal(toHordDenomination(depositCheckAmount));

        });

        it('should NOT be withdrawn ERC20 token by non-congress address', async() => {
            await expect(hordTreasuryContract.connect(owner).withdrawToken(aliceAddress, hordToken.address, toHordDenomination(withdrawTokenValue)))
            .to.be.revertedWith("HordUpgradable: Restricted only to HordCongress");
        });

        it('should withdraw ERC20 token', async() => {
            // Withdraw Hord ERC20 token
            const checkBalance = 19;
            const checkBalanceOf = 91;

            await hordTreasuryContract.connect(hordCongress).withdrawToken(aliceAddress, hordToken.address, toHordDenomination(withdrawTokenValue));

            let tokenBalance = await hordTreasuryContract.getTokenBalance(hordToken.address)
            expect(tokenBalance).to.be.equal(toHordDenomination(checkBalance));

            tokenBalance = await hordToken.balanceOf(aliceAddress);
            expect(tokenBalance).to.be.equal(toHordDenomination(checkBalanceOf));

            // Withdraw KEY ERC20 token
            await hordTreasuryContract.connect(hordCongress).withdrawToken(aliceAddress, keyToken.address, toHordDenomination(tokenCheckAmount));

            tokenBalance = await hordTreasuryContract.getTokenBalance(keyToken.address)
            expect(tokenBalance).to.be.equal(toHordDenomination(tokenCheckAmount));

            tokenBalance = await keyToken.balanceOf(aliceAddress);
            expect(tokenBalance).to.be.equal(toHordDenomination(tokenTransferAmount));
        });

        it('should check that totalTokenWithdrawn is properly updated', async() => {

            tokenBalanceBefore = await hordTreasuryContract.totalTokenWithdrawn(hordToken.address);

            expect(await hordTreasuryContract.connect(hordCongress).withdrawToken(aliceAddress, hordToken.address, toHordDenomination(tokenCheckAmount)))
                .to.emit(hordTreasuryContract, "WithdrawToken")
                .withArgs(aliceAddress, hordToken.address, toHordDenomination(tokenCheckAmount));

            tokenBalanceAfter = await hordTreasuryContract.totalTokenWithdrawn(hordToken.address);
            expect(new BigNumber.from(tokenBalanceBefore).add(toHordDenomination(tokenCheckAmount))).to.be.equal(tokenBalanceAfter);

        });

        it('should check that totalTokenReceived is properly updated', async() => {

            tokenBalanceBefore = await hordTreasuryContract.totalTokenReceived(hordToken.address);

            await hordToken.connect(owner).approve(hordTreasuryContract.address, toHordDenomination(tokenTransferAmount));

            await expect(hordTreasuryContract.connect(owner).depositToken(hordToken.address, toHordDenomination(tokenCheckAmount)))
               .to.emit(hordTreasuryContract,"DepositToken")
                .withArgs(owner.address, hordToken.address, toHordDenomination(tokenCheckAmount));

            tokenBalanceAfter = await hordTreasuryContract.totalTokenReceived(hordToken.address);
            expect(new BigNumber.from(tokenBalanceBefore).add(toHordDenomination(tokenCheckAmount))).to.be.equal(tokenBalanceAfter);
        });

    });

    describe('Deposit and Withdraw Ether', async() => {

        const withdrawEtherAmount = 10;
        const etherValue = 1;
        const withdrawEtherValue = 0.1;

        it('should NOT withdraw from the contract with zero token amount', async() => {
            hordTreasuryContract = hordTreasuryContract.connect(hordCongress);
            await expect(hordTreasuryContract.withdrawEther(aliceAddress, toHordDenomination(withdrawEtherAmount)))
            .to.be.revertedWith("HordTreasury: Failed to send Ether");
        });

        it('should NOT withdraw to the same contract', async() => {
            hordTreasuryContract = hordTreasuryContract.connect(hordCongress);
            await expect(hordTreasuryContract.withdrawEther(hordTreasuryContract.address, toHordDenomination(withdrawEtherAmount)))
            .to.be.revertedWith("HordTreasury: Can not withdraw to HordTreasury contract");
        });

        it('should deposit Ether', async() => {
            const tx = await alice.sendTransaction({
                to: hordTreasuryContract.address,
                value: ethers.utils.parseEther(etherValue.toString())
            });
            let ethBalance = await hordTreasuryContract.getEtherBalance();
            expect(ethBalance).to.be.equal(ethers.utils.parseEther(etherValue.toString()));
        });


        it('should check that totalETHWithdrawn is properly updated', async() => {

            const sendEthers = 5;
            
            await bob.sendTransaction({
                to: hordTreasuryContract.address,
                value: ethers.utils.parseEther(sendEthers.toString())
            });

            etherBalanceBefore = await hordTreasuryContract.totalETHWithdrawn();

            expect(await hordTreasuryContract.connect(hordCongress).withdrawEther(aliceAddress, ethers.utils.parseEther(etherValue.toString())))
                .to.emit(hordTreasuryContract,"WithdrawEther")
                .withArgs(aliceAddress, ethers.utils.parseEther(etherValue.toString()));

            etherBalanceAfter = await hordTreasuryContract.totalETHWithdrawn();
            expect(etherBalanceAfter).to.be.equal(new BigNumber.from(etherBalanceBefore).add(ethers.utils.parseEther(etherValue.toString())));

        });

        it('should check that totalETHReceived is properly updated', async() => {

            const addEthers = 0.000005;
            
            etherBalanceBefore = await hordTreasuryContract.totalETHReceived();

            await expect(bob.sendTransaction({
                to: hordTreasuryContract.address,
                value: ethers.utils.parseEther(addEthers.toString())
            })).to.emit(hordTreasuryContract, "DepositEther")
                .withArgs(bobAddress, ethers.utils.parseEther(addEthers.toString()));

            etherBalanceAfter = await hordTreasuryContract.totalETHReceived();
            expect(new BigNumber.from(etherBalanceBefore).add(ethers.utils.parseEther(addEthers.toString()))).to.be.equal(etherBalanceAfter);

        });

        it('should NOT withdraw Ether by non-congress address', async() => {
            await expect(hordTreasuryContract.connect(owner).withdrawEther(aliceAddress, ethers.utils.parseEther(withdrawEtherValue.toString())))
            .to.be.revertedWith("HordUpgradable: Restricted only to HordCongress");
        });

        it('should withdraw Ether', async() => {
            let oldContractEthBalance = await hordTreasuryContract.getEtherBalance();
            let oldBobEthBalance = await bob.getBalance();

            await hordTreasuryContract.connect(hordCongress).withdrawEther(bobAddress, ethers.utils.parseEther(withdrawEtherValue.toString()));

            let newEthBalance = await hordTreasuryContract.getEtherBalance();
            let newBobEthBalance = await bob.getBalance();

            expect(new BigNumber.from(oldContractEthBalance).sub(new BigNumber.from(newEthBalance))).to.be.equal(ethers.utils.parseEther(withdrawEtherValue.toString()));
            expect(new BigNumber.from(newBobEthBalance).sub(new BigNumber.from(oldBobEthBalance))).to.be.equal(ethers.utils.parseEther(withdrawEtherValue.toString()));
        });
    });
});
