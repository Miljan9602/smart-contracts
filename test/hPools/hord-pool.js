const {
    address,
    encodeParameters
} = require('../ethereum');
const hre = require("hardhat");
let configuration = require('../../deployments/deploymentConfig.json');
const { ethers, expect, isEthException, awaitTx, toHordDenomination, hexify } = require('../setup')

let config;
let accounts, owner, ownerAddr, hordCongress, hordCongressAddr, bob, bobAddr, alice, aliceAddr, maintainer, maintainerAddr,
    maintainersRegistry, hordTicketFactory, hordToken, hordTicketManager, hordTreasury;
let hPoolManager;
let chainlinkOracle, chainlinkOracleAddr, uniswapRouter, uniswapRouterAddr, hPoolFactory, hPoolFactoryAddr;

const minUSDToInitPool = 100;
const maxUSDAllocationPerTicket = 10;
const serviceFeePercent = 3;
const zeroValue = 0;

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
    chainlinkOracle = accounts[9]
    chainlinkOracleAddr = await chainlinkOracle.getAddress()
    uniswapRouter = accounts[4]
    uniswapRouterAddr = await uniswapRouter.getAddress()
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
                hPoolFactoryAddr, chainlinkOracleAddr, uniswapRouterAddr))
                .to.be.reverted;

            await expect(hPoolManager.initialize(hordCongressAddr, address(0),
                hordTicketFactory.address, hordTreasury.address, hordToken.address,
                hPoolFactoryAddr, chainlinkOracleAddr, uniswapRouterAddr))
                .to.be.reverted;

            await expect(hPoolManager.initialize(hordCongressAddr, maintainersRegistry.address,
                address(0), hordTreasury.address, hordToken.address,
                hPoolFactoryAddr, chainlinkOracleAddr, uniswapRouterAddr))
                .to.be.reverted;
        });

        it('should let initialize once', async () => {
            await hPoolManager.initialize(hordCongressAddr, maintainersRegistry.address,
                hordTicketFactory.address, hordTreasury.address, hordToken.address,
                hPoolFactoryAddr, chainlinkOracleAddr, uniswapRouterAddr);
        });

        it('sholud not let initialize twice', async () => {
            await expect(hPoolManager.connect(alice).initialize(hordCongressAddr, maintainersRegistry.address,
               hordTicketFactory.address, hordTreasury.address, hordToken.address,
               hPoolFactoryAddr, chainlinkOracleAddr, uniswapRouterAddr))
                    .to.be.reverted;
        });

        it('should not let non hordCongress call setMinimalUSDToInitPool function', async() => {
           await expect(hPoolManager.connect(bob).setMinimalUSDToInitPool(minUSDToInitPool))
               .to.be.reverted;
        });

        it('should not let to call setMinimalUSDToInitPool function with ', async() => {
            await expect(hPoolManager.connect(hordCongress).setMinimalUSDToInitPool(zeroValue))
                .to.be.reverted;
        });

        it('should let hordCongress to call setMinimalUSDToInitPool function with right arguments', async() => {
            await hPoolManager.connect(hordCongress).setMinimalUSDToInitPool(minUSDToInitPool)
            expect(await hPoolManager.minUSDToInitPool())
                .to.equal(minUSDToInitPool);
        });

        it('should not let non hordCongress call setMaxUSDAllocationPerTicket function', async() => {
            await expect(hPoolManager.connect(bob).setMaxUSDAllocationPerTicket(maxUSDAllocationPerTicket))
                .to.be.reverted;
        });

        it('should not let to call setMaxUSDAllocationPerTicket function with ', async() => {
            await expect(hPoolManager.connect(hordCongress).setMaxUSDAllocationPerTicket(zeroValue))
                .to.be.reverted;
        });

        it('should let hordCongress to call setMaxUSDAllocationPerTicket function with right arguments', async() => {
            await hPoolManager.connect(hordCongress).setMaxUSDAllocationPerTicket(maxUSDAllocationPerTicket)
            expect(await hPoolManager.maxUSDAllocationPerTicket())
                .to.equal(maxUSDAllocationPerTicket);
        });

        it('should not let non hordCongress call setServiceFeePercentAndPrecision function', async() => {
            await expect(hPoolManager.connect(bob).setServiceFeePercentAndPrecision(serviceFeePercent))
                .to.be.reverted;
        });

        it('should let hordCongress to call setServiceFeePercentAndPrecision function with right arguments', async() => {
            await hPoolManager.connect(hordCongress).setServiceFeePercentAndPrecision(serviceFeePercent)
            expect(await hPoolManager.serviceFeePercent())
                .to.equal(serviceFeePercent);
        });

    });

    describe('HPoolManager functions', async() => {

    });


});
