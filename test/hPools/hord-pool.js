const {
    address,
    encodeParameters
} = require('../ethereum');
const hre = require("hardhat");
const Web3 = require('web3');
let configuration = require('../../deployments/deploymentConfig.json');
const { ethers, expect, isEthException, awaitTx, toHordDenomination, hexify, BigNumber } = require('../setup')

let config;
let accounts, owner, ownerAddr, hordCongress, hordCongressAddr, bob, bobAddr, alice, aliceAddr, maintainer, maintainerAddr,
    maintainersRegistry, hordTicketFactory, hordToken, hordTicketManager, hordTreasury, hordConfiguration, champion, championAddr;
let hPoolManager;
let hPoolFactory, aggregatorV3;
let etherAmount, bePoolId, weiValue, poolState, poolId, hPool, nftTicketId;

async function setupContractAndAccounts () {
    config = configuration[hre.network.name]

    accounts = await ethers.getSigners()
    owner = accounts[0]
    ownerAddr = await owner.getAddress()
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
    const poolManager = await HPoolManager.deploy();

    await poolManager.deployed()
    hPoolManager = poolManager.connect(owner);
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
            bePoolId++;

            const pools = await hPoolManager.getChampionPoolIds(championAddr);
            const poolsNum = pools.length;

            expect(poolsNum)
                .to.be.equal(bePoolId);

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
            nftTicketId = 2;
            await expect(hPoolManager.connect(owner).setNftForPool(poolId, nftTicketId))
                .to.be.revertedWith("HordUpgradable: Restricted only to Maintainer");
        });

        it('should check values after maintainer calls setNftForPool function', async() => {
            await hPoolManager.connect(maintainer).setNftForPool(poolId, nftTicketId);
            poolId = 2;
            await hPoolManager.connect(maintainer).setNftForPool(poolId, nftTicketId);
            poolId = 3;
            await hPoolManager.connect(maintainer).setNftForPool(poolId, nftTicketId);
            poolId = 4;
            await hPoolManager.connect(maintainer).setNftForPool(poolId, nftTicketId);

            poolState = 1;
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
           nftTicketId = 2;
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
            nftTicketId = 2;

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

        //TODO: ERC1155 !!!!!
        xit('should', async() => {
            etherAmount = 10;
            weiValue = Web3.utils.toWei(etherAmount.toString(), 'ether');

            await hordTicketFactory.connect(owner).setApprovalForAll(hPoolManager.address, true);
            let b = await hordTicketFactory.balanceOf(ownerAddr, 2);
            console.log(b)
            await hPoolManager.privateSubscribeForHPool(poolId, { value: weiValue });

        });

        //TODO: add test if user wants to subscribe more than once
        xit('should not let user to subscribe more than once', async() => {

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

        //TODO: Check after values
        it('should check values after publicSubscribeForHPool function', async() => {
            poolId = 0;
            await hPoolManager.connect(owner).publicSubscribeForHPool(poolId, { value: weiValue });
            poolId = 3;
            await hPoolManager.connect(owner).publicSubscribeForHPool(poolId, { value: weiValue });
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

        //TODO: check more values
        it('should check values after endSubscriptionPhaseAndInitHPool function', async() => {
            poolId = 0;
            poolState = 5;
            await hPoolFactory.connect(hordCongress).setHPoolManager(hPoolManager.address);
            await hPoolManager.connect(maintainer).endSubscriptionPhaseAndInitHPool(poolId);

            hPool = await hPoolManager.hPools(poolId);

            expect(hPool.poolState)
                .to.be.equal(poolState);
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

        //TODO: check values
        it('should', async() => {
            poolId = 4;
            await hPoolManager.connect(maintainer).withdrawDeposit(poolId);
        });

    });

    describe('get functions', async() => {

        it('should check return values in getPoolInfo function', async() => {
           poolId = 0;
           hPool = await hPoolManager.connect(maintainer).getPoolInfo(poolId);

           expect(hPool[2])
               .to.be.equal(championAddr);
            expect(hPool[4])
                .to.be.equal(nftTicketId);
           expect(hPool[5])
               .to.be.equal(true);
        });


    });


});
