const {
    address,
    encodeParameters
} = require('../ethereum');
const hre = require("hardhat");
const Web3 = require('web3');
let configuration = require('../../deployments/deploymentConfig.json');
const { ethers, expect, isEthException, awaitTx, toHordDenomination, waitForSomeTime, BigNumber } = require('../setup')

let config;
let accounts, owner, ownerAddr, user, userAddr, user1, user1Addr, hordCongress, hordCongressAddr, bob, bobAddr, alice, aliceAddr, maintainer, maintainerAddr,
    maintainersRegistry, hordTicketFactory, hordToken, hordTicketManager, hordTreasury, hordConfiguration, champion, championAddr, ticketFactory, factoryAddr, hPoolM, hPoolMAddr;
let hPoolManager;
let hPoolFactory, aggregatorV3;
let etherAmount, bePoolId, weiValue, poolState, poolId, hPool, nftTicketId, championId, tokenId, tx;

const zeroValue = 0;

async function setupContractAndAccounts () {
    config = configuration[hre.network.name]

    accounts = await ethers.getSigners()
    owner = accounts[0]
    ownerAddr = await owner.getAddress()
    ticketFactory = accounts[4]
    factoryAddr = await ticketFactory.getAddress()
    hordCongress = accounts[5]
    hordCongressAddr = await hordCongress.getAddress()
    alice = accounts[6];
    aliceAddr = await alice.getAddress()
    bob = accounts[7];
    bobAddr = await bob.getAddress()
    maintainer = accounts[8]
    maintainerAddr = await maintainer.getAddress()
    champion = accounts[9]
    championAddr = await champion.getAddress()
    hPoolM = accounts[3]
    hPoolMAddr = await hPoolM.getAddress()
    user = accounts[2]
    userAddr = await user.getAddress()
    user1 = accounts[1]
    user1Addr = await user1.getAddress()

    const Hord = await hre.ethers.getContractFactory("HordToken");
    hordToken = await Hord.deploy(
        config.hordTokenName,
        config.hordTokenSymbol,
        toHordDenomination(config.hordTotalSupply.toString()),
        ownerAddr
    );
    await hordToken.deployed()
    hordToken = hordToken.connect(owner)

    const MaintainersRegistry = await ethers.getContractFactory('MaintainersRegistry')
    maintainersRegistry = await upgrades.deployProxy(MaintainersRegistry, [[maintainerAddr], hordCongressAddr]);
    await maintainersRegistry.deployed()

    const HordTicketManager = await ethers.getContractFactory('HordTicketManager');
    hordTicketManager = await upgrades.deployProxy(HordTicketManager, [
            hordCongressAddr,
            maintainersRegistry.address,
            hordToken.address,
            config['minTimeToStake'],
            toHordDenomination(config['minAmountToStake'])
        ]
    );
    await hordTicketManager.deployed()

    const HordTicketFactory = await ethers.getContractFactory('HordTicketFactory')
    hordTicketFactory = await upgrades.deployProxy(HordTicketFactory, [
            hordCongressAddr,
            maintainersRegistry.address,
            hordTicketManager.address,
            config["maxFungibleTicketsPerPool"],
            config["uri"],
            config["contractMetadataUri"]
        ]
    );
    await hordTicketFactory.deployed()

    await hordTicketManager.setHordTicketFactory(hordTicketFactory.address);

    const HordTreasury = await ethers.getContractFactory('HordTreasury');
    hordTreasury = await upgrades.deployProxy(HordTreasury, [
        hordCongressAddr,
        maintainersRegistry.address
    ]);
    await hordTreasury.deployed()

    const AggregatorV3 = await ethers.getContractFactory("MockAggregatorV3Interface");
    const aggregator = await AggregatorV3.deploy();

    await aggregator.deployed();
    aggregatorV3 = aggregator.connect(owner);

    const HordConfiguration = await ethers.getContractFactory('HordConfiguration')
    hordConfiguration = await upgrades.deployProxy(HordConfiguration, [
            hordCongressAddr,
            maintainersRegistry.address,
            config["minChampStake"],
            config["maxWarmupPeriod"],
            config["maxFollowerOnboardPeriod"],
            config["minFollowerEthStake"],
            config["maxFollowerEthStake"],
            config["minStakePerPoolTicket"],
            config["assetUtilizationRatio"],
            config["gasUtilizationRatio"],
            config["platformStakeRatio"],
            config["maxSupplyHPoolToken"],
            config["maxUSDAllocationPerTicket"]
        ]
    );
    await hordConfiguration.deployed()

    const HPoolFactory = await ethers.getContractFactory('HPoolFactory')
    hPoolFactory = await upgrades.deployProxy(HPoolFactory, [
            hordCongressAddr,
            maintainersRegistry.address
        ]
    );

    await hPoolFactory.deployed()

    const HPoolManager = await ethers.getContractFactory('HPoolManager');
    hPoolManager = await HPoolManager.deploy();

    await hPoolManager.deployed();
}

describe('hPools', async () => {
    before('setup contracts', async () => {
        await setupContractAndAccounts();
    });

    describe('Test initial values are properly set in HPoolManager contract', async() => {

        it('should not let pass 0x0 address in initialize function', async () => {
            await expect(hPoolManager.initialize(address(0), maintainersRegistry.address,
                hordTicketFactory.address, hordTreasury.address, hordToken.address,
                hPoolFactory.address, aggregatorV3.address, hordConfiguration.address))
                .to.be.reverted;

            await expect(hPoolManager.initialize(hordCongressAddr, address(0),
                hordTicketFactory.address, hordTreasury.address, hordToken.address,
                hPoolFactory.address, aggregatorV3.address, hordConfiguration.address))
                .to.be.reverted;

            await expect(hPoolManager.initialize(hordCongressAddr, maintainersRegistry.address,
                address(0), hordTreasury.address, hordToken.address,
                hPoolFactory.address, aggregatorV3.address, hordConfiguration.address))
                .to.be.reverted;

            await expect(hPoolManager.initialize(hordCongressAddr, maintainersRegistry.address,
                hordTicketFactory.address, hordTreasury.address, hordToken.address,
                hPoolFactory.address, aggregatorV3.address, address(0)))
                .to.be.reverted;
        });

        it('should let initialize once', async () => {
            await hPoolManager.initialize(hordCongressAddr, maintainersRegistry.address,
                hordTicketFactory.address, hordTreasury.address, hordToken.address,
                hPoolFactory.address, aggregatorV3.address, hordConfiguration.address);
        });

        it('sholud not let initialize twice', async () => {
            await expect(hPoolManager.connect(alice).initialize(hordCongressAddr, maintainersRegistry.address,
               hordTicketFactory.address, hordTreasury.address, hordToken.address,
                hPoolFactory.address, aggregatorV3.address, hordConfiguration.address))
                    .to.be.reverted;
        });

    });

    describe('Create hPool by champion', async() => {

        it('should not let to ETH amount is less than minimal deposit in createHPool function', async() => {
            etherAmount = 0;
            bePoolId = 5;
            weiValue = Web3.utils.toWei(etherAmount.toString(), 'ether');

            await expect(hPoolManager.connect(champion).createHPool(bePoolId, { value: weiValue }))
                .to.be.revertedWith( "ETH amount is less than minimal deposit.");
        });

        it('should check length of hPools array after createHPool function', async() => {
            etherAmount = 10;
            bePoolId = 0;
            weiValue = Web3.utils.toWei(etherAmount.toString(), 'ether');

            await hPoolManager.connect(champion).createHPool(bePoolId, { value: weiValue });
            bePoolId++;
            await hPoolManager.connect(champion).createHPool(bePoolId, { value: weiValue });
            bePoolId++;
            await hPoolManager.connect(champion).createHPool(bePoolId, { value: weiValue });
            bePoolId++;
            await hPoolManager.connect(champion).createHPool(bePoolId, { value: weiValue });
            bePoolId++;
            await hPoolManager.connect(champion).createHPool(bePoolId, { value: weiValue });
            bePoolId ++;
            await hPoolManager.connect(champion).createHPool(bePoolId, { value: weiValue });
            bePoolId++;
            tx = await awaitTx(hPoolManager.connect(champion).createHPool(bePoolId, { value: weiValue }));

            const pools = await hPoolManager.getChampionPoolIds(championAddr);
            const poolsNum = pools.length;

            expect(poolsNum)
                .to.be.equal(bePoolId + 1);

        });

        it('should check PoolInitRequested event', async() => {
            expect(tx.events.length).to.equal(2);
            expect(tx.events[0].event).to.equal('PoolInitRequested');
            expect(parseInt(tx.events[0].args.bePoolId)).to.equal(bePoolId);
        });

        it('should check championEthDeposit of hPool after createHPool function', async() => {
            poolId = 0;
            hPool = await hPoolManager.hPools(poolId);
            expect(hPool.championEthDeposit)
                .to.be.equal(weiValue);
        });

        it('should check poolState of hPool after createHPool function', async() => {
            hPool = await hPoolManager.hPools(poolId);
            poolState = 0;
            expect(hPool.poolState)
                .to.be.equal(poolState);
        });

        it('should check championAddress of hPool after createHPool function', async() => {
            hPool = await hPoolManager.hPools(poolId);
            expect(hPool.championAddress)
                .to.be.equal(championAddr);
        });

    });

    describe('setNftForPool by maintainer', async() => {

        it('should not let nonMaintainer address to call setNftForPool function', async() => {
            nftTicketId = 1;
            await expect(hPoolManager.connect(owner).setNftForPool(poolId, nftTicketId))
                .to.be.revertedWith("HordUpgradable: Restricted only to Maintainer");
        });

        it('should mint some NFT`s', async() => {
            etherAmount = 30;

            let lastAddedId = await hordTicketFactory.lastMintedTokenId();
            tokenId = parseInt(lastAddedId,10) + 1;
            championId = 1;
            await awaitTx(hordTicketFactory.connect(maintainer).mintNewHPoolNFT(tokenId, etherAmount, championId));
        });

        it('should not let to set NFT which does not exist', async() => {
            nftTicketId = 3;
            await expect(hPoolManager.connect(maintainer).setNftForPool(poolId, nftTicketId))
                .to.be.reverted;
        })

        it('should check values after maintainer calls setNftForPool function', async() => {
            nftTicketId = 1;
            await hPoolManager.connect(maintainer).setNftForPool(poolId, nftTicketId);
            poolId = 2;
            await hPoolManager.connect(maintainer).setNftForPool(poolId, nftTicketId);
            poolId = 3;
            await hPoolManager.connect(maintainer).setNftForPool(poolId, nftTicketId);
            poolId = 4;
            await hPoolManager.connect(maintainer).setNftForPool(poolId, nftTicketId);
            poolId = 5;
            await hPoolManager.connect(maintainer).setNftForPool(poolId, nftTicketId);
            poolId = 6;
            await hPoolManager.connect(maintainer).setNftForPool(poolId, nftTicketId);

            poolState = 1;
            poolId = 4;
            hPool = await hPoolManager.hPools(poolId);

            expect(hPool.isValidated)
                .to.be.equal(true);

            expect(hPool.nftTicketId)
                .to.be.equal(nftTicketId);

            expect(hPool.poolState)
                .to.be.equal(poolState);
        });

        it('should not let to set nft for hPool which does not exist', async() => {
           poolId = 10;
           nftTicketId = 1;
           await expect(hPoolManager.connect(maintainer).setNftForPool(poolId, nftTicketId))
               .to.be.revertedWith("hPool with poolId does not exist.");
        });

        it('should not let to set nftTicketId with 0 value', async() => {
            poolId = 0;
            nftTicketId = 0;
            await expect(hPoolManager.connect(maintainer).setNftForPool(poolId, nftTicketId))
                .to.be.revertedWith("NFT id can not be 0.");
        });

        it('should not let to validate same hPool twice', async() => {
            poolId = 0;
            nftTicketId = 1;

            await expect(hPoolManager.connect(maintainer).setNftForPool(poolId, nftTicketId))
                .to.be.revertedWith("hPool already validated.");
        });

    });

    describe('private subscription phase', async() => {

        it('should not let nonMaintainer address to call startPrivateSubscriptionPhase function', async() => {
            await expect(hPoolManager.connect(owner).startPrivateSubscriptionPhase(poolId))
                .to.be.revertedWith("HordUpgradable: Restricted only to Maintainer");
        });

        it('should check values after maintainer calls startPrivateSubscriptionPhase function', async() => {
            await hPoolManager.connect(maintainer).startPrivateSubscriptionPhase(poolId);
            poolId = 2;
            await hPoolManager.connect(maintainer).startPrivateSubscriptionPhase(poolId);
            poolId = 3;
            await hPoolManager.connect(maintainer).startPrivateSubscriptionPhase(poolId);
            poolId = 4;
            await hPoolManager.connect(maintainer).startPrivateSubscriptionPhase(poolId);
            poolId = 5;
            await hPoolManager.connect(maintainer).startPrivateSubscriptionPhase(poolId);
            poolId = 6;
            await hPoolManager.connect(maintainer).startPrivateSubscriptionPhase(poolId);

            poolState = 2;
            hPool = await hPoolManager.hPools(poolId);
            expect(hPool.poolState)
                .to.be.equal(poolState);
        });

        it('should not let to start private subscription phase if hPool does not exist', async() => {
           poolId = 10;
           await expect(hPoolManager.connect(maintainer).startPrivateSubscriptionPhase(poolId))
               .to.be.revertedWith("hPool with poolId does not exist.");
        });

        it('should check if previous state is not TICKET_SALE state', async() => {
            poolId = 0;
            await expect(hPoolManager.connect(maintainer).startPrivateSubscriptionPhase(poolId))
                .to.be.reverted;
        });

        it('should check if previous state is not PRIVATE_SUBSCRIPTION state', async() => {
            poolId = 1;
            etherAmount = 10;
            weiValue = Web3.utils.toWei(etherAmount.toString(), 'ether');

            await expect(hPoolManager.connect(owner).privateSubscribeForHPool(poolId, { value: weiValue }))
                .to.be.revertedWith("hPool is not in PRIVATE_SUBSCRIPTION state.");
        });

        it('should check if msg.value is equal 0 in privateSubscribeForHPool function', async() => {
            poolId = 0;
            etherAmount = 0;
            weiValue = Web3.utils.toWei(etherAmount.toString(), 'ether');

            await expect(hPoolManager.connect(bob).privateSubscribeForHPool(poolId, { value: weiValue }))
                .to.be.reverted;
        });

        it('should check values after privateSubscribeForHPool function', async() => {
            etherAmount = 30;

            await hordToken.connect(owner).transfer(bobAddr, toHordDenomination(config['minAmountToStake'] * 3));
            await hordToken.connect(owner).transfer(aliceAddr, toHordDenomination(config['minAmountToStake'] * 3));
            await hordToken.connect(owner).transfer(user1Addr, toHordDenomination(config['minAmountToStake'] * 3));

            let numberOfTickets = 3;
            let balanceB = await hordToken.balanceOf(bobAddr);
            await hordToken.connect(bob).approve(hordTicketManager.address, balanceB);
            await hordTicketManager.connect(bob).stakeAndReserveNFTs(tokenId, numberOfTickets);

            let balanceA = await hordToken.balanceOf(aliceAddr);
            await hordToken.connect(alice).approve(hordTicketManager.address, balanceA);
            await hordTicketManager.connect(alice).stakeAndReserveNFTs(tokenId, numberOfTickets);

            let balanceU = await hordToken.balanceOf(user1Addr);
            await hordToken.connect(user1).approve(hordTicketManager.address, balanceU);
            await hordTicketManager.connect(user1).stakeAndReserveNFTs(tokenId, numberOfTickets);

            let startIndex = 0;
            let endIndex = await hordTicketManager.getNumberOfStakesForUserAndToken(bobAddr, tokenId);

            await waitForSomeTime(owner.provider, config["minTimeToStake"]);
            await hordTicketManager.connect(bob).claimNFTs(tokenId, startIndex, endIndex);

            endIndex = await hordTicketManager.getNumberOfStakesForUserAndToken(aliceAddr, tokenId);

            await waitForSomeTime(owner.provider, config["minTimeToStake"]);
            await hordTicketManager.connect(alice).claimNFTs(tokenId, startIndex, endIndex);

            endIndex = await hordTicketManager.getNumberOfStakesForUserAndToken(user1Addr, tokenId);

            await waitForSomeTime(owner.provider, config["minTimeToStake"]);
            await hordTicketManager.connect(user1).claimNFTs(tokenId, startIndex, endIndex);

            etherAmount = 2;
            poolId = 3;

            await hordTicketFactory.connect(user1).setApprovalForAll(hPoolManager.address, true);
            await hPoolManager.connect(user1).privateSubscribeForHPool(poolId, { value: etherAmount });

            poolId = 4;

            await hordTicketFactory.connect(bob).setApprovalForAll(hPoolManager.address, true);
            await hPoolManager.connect(bob).privateSubscribeForHPool(poolId, { value: etherAmount });

            await hordTicketFactory.connect(alice).setApprovalForAll(hPoolManager.address, true);
            await hPoolManager.connect(alice).privateSubscribeForHPool(poolId, { value: etherAmount });
            hPool = await hPoolManager.hPools(poolId);

            expect(hPool.followersEthDeposit)
                .to.be.equal(etherAmount * 2);

        });

        it('should not let user to subscribe more than once', async() => {
            etherAmount = 10;
            await expect(hPoolManager.connect(bob).privateSubscribeForHPool(poolId, { value: etherAmount }))
                .to.be.revertedWith("User can not subscribe more than once.");
        });


    });

    describe('public subscription phase', async() => {

        it('should not let nonMaintainer address to call startPublicSubscriptionPhase function', async() => {
            poolId = 0;
            await expect(hPoolManager.connect(owner).startPublicSubscriptionPhase(poolId))
                .to.be.revertedWith("HordUpgradable: Restricted only to Maintainer");
        });

        it('should check values after maintainer calls startPublicSubscriptionPhase function', async() => {
            await hPoolManager.connect(maintainer).startPublicSubscriptionPhase(poolId);
            poolId = 2;
            await hPoolManager.connect(maintainer).startPublicSubscriptionPhase(poolId);
            poolId = 3;
            await hPoolManager.connect(maintainer).startPublicSubscriptionPhase(poolId);
            poolId = 4;
            await hPoolManager.connect(maintainer).startPublicSubscriptionPhase(poolId);
            poolId = 5;
            await hPoolManager.connect(maintainer).startPublicSubscriptionPhase(poolId);
            poolId = 6;
            await hPoolManager.connect(maintainer).startPublicSubscriptionPhase(poolId);


            poolState = 3;
            hPool = await hPoolManager.hPools(poolId);
            expect(hPool.poolState)
                .to.be.equal(poolState);
        });

        it('should not let to start public subscription phase if hPool does not exist', async() => {
            poolId = 10;
            await expect(hPoolManager.connect(maintainer).startPublicSubscriptionPhase(poolId))
                .to.be.revertedWith("hPool with poolId does not exist.");
        });

        it('should check if previous state is not PRIVATE_SUBSCRIPTION state', async() => {
            poolId = 0;
            await expect(hPoolManager.connect(maintainer).startPublicSubscriptionPhase(poolId))
                .to.be.reverted;
        });

        it('should check if previous state is not PUBLIC_SUBSCRIPTION state in publicSubscribeForHPool function', async() => {
            poolId = 1;
            etherAmount = 10;
            weiValue = Web3.utils.toWei(etherAmount.toString(), 'ether');

            await expect(hPoolManager.connect(owner).publicSubscribeForHPool(poolId, { value: weiValue }))
                .to.be.revertedWith("hPool is not in PUBLIC_SUBSCRIPTION state.");
        });

        it('should check values after publicSubscribeForHPool function', async() => {
            let amountBeofre;
            let amountAfter;

            poolId = 0;
            hPool = await hPoolManager.hPools(poolId);
            amountBeofre = hPool.followersEthDeposit;
            await hPoolManager.connect(owner).publicSubscribeForHPool(poolId, { value: weiValue });
            hPool = await hPoolManager.hPools(poolId);
            amountAfter = hPool.followersEthDeposit;
            resp = await amountBeofre.add(weiValue);

            expect(amountAfter)
                .to.be.equal(resp);

            poolId = 3;
            hPool = await hPoolManager.hPools(poolId);
            amountBeofre = hPool.followersEthDeposit;
            await hPoolManager.connect(owner).publicSubscribeForHPool(poolId, { value: weiValue });
            hPool = await hPoolManager.hPools(poolId);
            amountAfter = hPool.followersEthDeposit;
            resp = await amountBeofre.add(weiValue);

            expect(amountAfter)
                .to.be.equal(resp);

            poolId = 5;
            hPool = await hPoolManager.hPools(poolId);
            amountBeofre = hPool.followersEthDeposit;
            await hPoolManager.connect(owner).publicSubscribeForHPool(poolId, { value: weiValue });
            hPool = await hPoolManager.hPools(poolId);
            amountAfter = hPool.followersEthDeposit;
            resp = await amountBeofre.add(weiValue);

            expect(amountAfter)
                .to.be.equal(resp);

            poolId = 6;
            hPool = await hPoolManager.hPools(poolId);
            amountBeofre = hPool.followersEthDeposit;
            await hPoolManager.connect(owner).publicSubscribeForHPool(poolId, { value: weiValue });
            hPool = await hPoolManager.hPools(poolId);
            amountAfter = hPool.followersEthDeposit;
            resp = await amountBeofre.add(weiValue);

            expect(amountAfter)
                .to.be.equal(resp);

        });

        it('should not let user to subscribe more than once', async() => {
            await expect(hPoolManager.connect(owner).publicSubscribeForHPool(poolId, { value: weiValue }))
                .to.be.revertedWith("User can not subscribe more than once.");
        });

    });

    describe('end subscription phase', async() => {

        it('should not let nonMaintainer address to call endSubscriptionPhaseAndInitHPool function', async() => {
            poolId = 0;
            await expect(hPoolManager.connect(owner).endSubscriptionPhaseAndInitHPool(poolId))
                .to.be.revertedWith("HordUpgradable: Restricted only to Maintainer");
        });

        it('should check if previous state is not PUBLIC_SUBSCRIPTION state in endSubscriptionPhaseAndInitHPool function', async() => {
            poolId = 1;
            await expect(hPoolManager.connect(maintainer).endSubscriptionPhaseAndInitHPool(poolId))
                .to.be.revertedWith("hPool is not in subscription state.");
        });

        it('should check if argument is equal 0x0 address in setHPoolManager function', async() => {
            await expect(hPoolFactory.setHPoolManager(address(0)))
                .to.be.reverted;
        });

        it('should check values after endSubscriptionPhaseAndInitHPool function', async() => {
            poolId = 0;
            poolState = 5;
            await hPoolFactory.connect(hordCongress).setHPoolManager(hPoolManager.address);
            await hPoolManager.connect(maintainer).endSubscriptionPhaseAndInitHPool(poolId);
            poolId = 5;
            await hPoolManager.connect(maintainer).endSubscriptionPhaseAndInitHPool(poolId);
            poolId = 6;
            await hPoolManager.connect(maintainer).endSubscriptionPhaseAndInitHPool(poolId);

            poolId = 0;
            hPool = await hPoolManager.hPools(poolId);

            expect(hPool.poolState)
                .to.be.equal(poolState);

            let treasuryFeeETH = await hPool.followersEthDeposit.mul(config["gasUtilizationRatio"]);
            let percentPrecision = await hordConfiguration.percentPrecision();
            let treasuryFeePaid = treasuryFeeETH.div(percentPrecision);

            expect(hPool.treasuryFeePaid)
                .to.be.equal(treasuryFeePaid);
        });

        it('should not let to setHPoolManager twice', async() => {
            await expect(hPoolFactory.setHPoolManager(hPoolManager.address))
                .to.be.reverted;
        });

        it('should not let non hPoolManager address to call deployHPool function', async() => {
            await expect(hPoolFactory.connect(hordCongress).deployHPool())
                .to.be.reverted;
        });

        it('should check return values in getDeployedHPools function', async() => {
            let startIndex = 0;
            let endIndex = 2;

            let hPools = await hPoolFactory.connect(hordCongress).getDeployedHPools(startIndex, endIndex);
            poolId = 5;
            hPool = await hPoolManager.hPools(poolId);

            expect(hPools[1])
                .to.be.equal(hPool.hPoolContractAddress);
        });

        it('should check if hPool subscription amount is below threshold in endSubscriptionPhaseAndInitHPool function', async() => {
            poolId = 2;
            hPool = await hPoolManager.hPools(poolId);

            await expect(hPoolManager.connect(maintainer).endSubscriptionPhaseAndInitHPool(poolId))
                .to.be.revertedWith("hPool subscription amount is below threshold.");
        });

        it('should not let nonMaintainer address to call endSubscriptionPhaseAndTerminatePool function', async() => {
            poolId = 3;
            await expect(hPoolManager.connect(owner).endSubscriptionPhaseAndTerminatePool(poolId))
                .to.be.revertedWith("HordUpgradable: Restricted only to Maintainer");
        });

        it('should check if previous state is not PUBLIC_SUBSCRIPTION state in endSubscriptionPhaseAndTerminatePool function', async() => {
            poolId = 1;
            await expect(hPoolManager.connect(maintainer).endSubscriptionPhaseAndTerminatePool(poolId))
                .to.be.revertedWith("hPool is not in subscription state.");
        });

        it('should check if hPool subscription amount is below threshold in endSubscriptionPhaseAndTerminatePool function', async() => {
            poolId = 3;
            hPool = await hPoolManager.hPools(poolId);

            await expect(hPoolManager.connect(maintainer).endSubscriptionPhaseAndTerminatePool(poolId))
                .to.be.revertedWith("hPool subscription amount is above threshold.");
        });

        it('should check pool state after endSubscriptionPhaseAndTerminatePool function', async() => {
            poolId = 4;
            poolState = 4;

            await hPoolManager.connect(maintainer).endSubscriptionPhaseAndTerminatePool(poolId);
            hPool = await hPoolManager.hPools(poolId);

            expect(hPool.poolState)
                .to.be.equal(poolState);
        });

    });

    describe('post subscription phase', async() => {

        it('should not let to pass if previous state is not SUBSCRIPTION_FAILED state in withdrawDeposit function', async() => {
            poolId = 0;
            await expect(hPoolManager.connect(bob).withdrawDeposit(poolId))
                .to.be.revertedWith("Pool is not in valid state.");
        });

        it('should check values after withdrawDeposit function', async() => {
            poolId = 4;
            await hPoolManager.connect(bob).withdrawDeposit(poolId);
            let bobSubscription = await hPoolManager.getUserSubscriptionForPool(poolId, bobAddr);

            expect(bobSubscription[1])
                .to.be.equal(zeroValue);
        });

        it('should not let to make safeTransferFrom if number of tickets is equal 0 in withdrawDeposit function', async() => {
            await hPoolManager.connect(owner).withdrawDeposit(poolId);

            let ownerSubscription = await hPoolManager.connect(owner).getUserSubscriptionForPool(poolId, bobAddr);

            expect(ownerSubscription[1])
                .to.be.equal(zeroValue);
        });

        it('should not let to pass if deposit already withdrawn withdrawDeposit function', async() => {
            await expect(hPoolManager.connect(bob).withdrawDeposit(poolId))
                .to.be.revertedWith("Subscription already withdrawn");
        });

        it('should not let user to withdraw tickets if user did not participate in this hPool in withdrawTickets function ', async() => {
            poolId = 4;
            await expect(hPoolManager.connect(user).withdrawTickets(poolId))
                .to.be.revertedWith("User did not participate in this hPool.");
        });

        it('should not let to pass if previous state is before subscription phase in withdrawTickets function ', async() => {
            poolId = 3;
            await expect(hPoolManager.connect(user1).withdrawTickets(poolId))
                .to.be.revertedWith("Only after Subscription phase user can withdraw tickets.");
        });

        it('should check values after withdrawTickets function ', async() => {
            poolId = 4;
            await hPoolManager.connect(alice).withdrawTickets(poolId);
            let aliceSubscription = await hPoolManager.getUserSubscriptionForPool(poolId, aliceAddr);

            expect(aliceSubscription[1])
                .to.be.equal(zeroValue);
        });

        it('should not let to pass if tickets already withdrawn withdrawDeposit function', async() => {
            await expect(hPoolManager.connect(alice).withdrawTickets(poolId))
                .to.be.revertedWith("User have already withdrawn his tickets.");
        });

    });

    describe('get functions', async() => {

        it('should check return values in getPoolInfo function', async() => {
           poolId = 0;
           let hPoolInfo = await hPoolManager.connect(maintainer).getPoolInfo(poolId);

           expect(hPoolInfo[2])
               .to.be.equal(championAddr);
           expect(hPoolInfo[4])
                .to.be.equal(nftTicketId);
           expect(hPoolInfo[5])
               .to.be.equal(true);
        });

        it('should check return values in getDecimalsReturnPrecision function', async() => {
            let checkDecimals = 10;
            let decimals = await hPoolManager.getDecimalsReturnPrecision();

            expect(decimals)
               .to.be.equal(checkDecimals);
        });

        it('should check if amounthEth of subscription is equal 0 in getMaxUserSubscriptionInETH function', async() => {
            poolId = 4;
            let maxUserSubscription = await hPoolManager.getMaxUserSubscriptionInETH(bobAddr, poolId);
            expect(maxUserSubscription)
                .to.be.equal(zeroValue);
        });

        it('should check return values in getMaxUserSubscriptionInETH function', async() => {
            poolId = 0;
            let maxUserSubscription = await hPoolManager.getMaxUserSubscriptionInETH(bobAddr, poolId);
            hPool = await hPoolManager.hPools(poolId);
            let numberOfTickets = await hordTicketFactory.balanceOf(bobAddr, hPool.nftTicketId);
            let maxUserSubscriptionPerTicket = await hPoolManager.getMaxSubscriptionInETHPerTicket();
            let resp = await numberOfTickets.mul(maxUserSubscriptionPerTicket);

            expect(resp)
                .to.be.equal(maxUserSubscription);
        });

        it('should check return values in getPoolsUserSubscribedFor function', async() => {
            poolId = 4;
            let hPoolIds = await hPoolManager.getPoolsUserSubscribedFor(bobAddr);

            expect(hPoolIds[0])
                .to.be.equal(poolId);
        });

        it('should check return values in getLastMintedTokenId function', async() => {
            expect(await hordTicketFactory.getLastMintedTokenId())
               .to.be.equal(tokenId);
        });

    });


});
