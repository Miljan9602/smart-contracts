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
let hPoolFactory, hPoolFactoryAddr, aggregatorV3;
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
    hPoolFactory = accounts[3]
    hPoolFactoryAddr = await hPoolFactory.getAddress()

    const Hord = await hre.ethers.getContractFactory("HordToken");
    hordToken = await Hord.deploy(
        config.hordTokenName,
        config.hordTokenSymbol,
        toHordDenomination(config.hordTotalSupply.toString()),
        hordCongress.address
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
                hPoolFactoryAddr, aggregatorV3.address, hordConfiguration.address))
                .to.be.reverted;

            await expect(hPoolManager.initialize(hordCongressAddr, address(0),
                hordTicketFactory.address, hordTreasury.address, hordToken.address,
                hPoolFactoryAddr, aggregatorV3.address, hordConfiguration.address))
                .to.be.reverted;

            await expect(hPoolManager.initialize(hordCongressAddr, maintainersRegistry.address,
                address(0), hordTreasury.address, hordToken.address,
                hPoolFactoryAddr, aggregatorV3.address, hordConfiguration.address))
                .to.be.reverted;

            await expect(hPoolManager.initialize(hordCongressAddr, maintainersRegistry.address,
                hordTicketFactory.address, hordTreasury.address, hordToken.address,
                hPoolFactoryAddr, aggregatorV3.address, address(0)))
                .to.be.reverted;
        });

        it('should let initialize once', async () => {
            await hPoolManager.initialize(hordCongressAddr, maintainersRegistry.address,
                hordTicketFactory.address, hordTreasury.address, hordToken.address,
                hPoolFactoryAddr, aggregatorV3.address, hordConfiguration.address);
        });

        it('sholud not let initialize twice', async () => {
            await expect(hPoolManager.connect(alice).initialize(hordCongressAddr, maintainersRegistry.address,
               hordTicketFactory.address, hordTreasury.address, hordToken.address,
               hPoolFactoryAddr, aggregatorV3.address, hordConfiguration.address))
                    .to.be.reverted;
        });

    });

    describe('Create hPool by champion', async() => {

        it('should check length of hPools array after createHPool function', async() => {
            etherAmount = 10;
            bePoolId = 0;
            weiValue = Web3.utils.toWei(etherAmount.toString(), 'ether');

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

        xit('should not let to ETH amount is less than minimal deposit in createHPool function', async() => {
            etherAmount = 10;
            weiValue = Web3.utils.toWei(etherAmount.toString(), 'ether');
            /*  await expect(hPoolManager.createHPool({ value: ethers.utils.parseEther(etherAmount.toString()) }))
                    .to.be.revertedWith("ETH amount is less than minimal deposit");
            */
           /* await expect(hPoolManager.connect(champion).createHPool(bePoolId, { value: weiValue }))
                .to.be.revertedWith("ETH amount is less than minimal deposit");
            */

            let a = await hPoolManager.getMinimalETHToInitPool();
            let b = new BigNumber.from(weiValue);

            console.log(a);
            console.log(b);
            console.log(a > b)
            console.log(a < b)

            await hPoolManager.createHPool(bePoolId, { value: b });

        });


        xit('should let only direct conntract calls', async() => {
            await expect(hPoolManager.createHPool())
                .to.be.revertedWith("Only direct contract calls.");
        });


    });

    describe('setNftForPool by maintainer', async() => {

        it('should not let nonMaintainer address to call setNftForPool function', async() => {
            await expect(hPoolManager.connect(owner).setNftForPool(poolId, 2))
                .to.be.revertedWith("HordUpgradable: Restricted only to Maintainer");
        });

        it('should check values after maintainer calls setNftForPool function', async() => {
            nftTicketId = 2;

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

        it('should not let nonMaintainer address to call setNftForPool function', async() => {
            await expect(hPoolManager.connect(owner).startPrivateSubscriptionPhase(poolId))
                .to.be.revertedWith("HordUpgradable: Restricted only to Maintainer");
        });

        it('should check values after maintainer calls startPrivateSubscriptionPhase function', async() => {
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

        /*it('should', async() => {
            poolId = 0;
            etherAmount = 10;
            weiValue = Web3.utils.toWei(etherAmount.toString(), 'ether');
            await hPoolManager.privateSubscribeForHPool(poolId, { value: weiValue, from:  });
        });*/

    });


});
