const {
    address,
    encodeParameters
} = require('./ethereum');
const hre = require("hardhat");
let configuration = require('../deployments/deploymentConfig.json');
const { ethers, expect } = require('./setup')

let config;
let accounts, owner, ownerAddr, hordCongress, hordCongressAddr, maintainer, maintainerAddr, maintainersRegistry, hordConfiguration;

async function setupContractAndAccounts () {
    config = configuration[hre.network.name]

    accounts = await ethers.getSigners()
    owner = accounts[0]
    ownerAddr = await owner.getAddress()
    hordCongress = accounts[5]
    hordCongressAddr = await hordCongress.getAddress()
    maintainer = accounts[8]
    maintainerAddr = await maintainer.getAddress()

    const MaintainersRegistry = await ethers.getContractFactory('MaintainersRegistry')
    maintainersRegistry = await upgrades.deployProxy(MaintainersRegistry, [[maintainerAddr], hordCongressAddr]);
    await maintainersRegistry.deployed()

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
}

describe('HordConfiguration', async() => {

    before('setup contracts', async () => {
        await setupContractAndAccounts();
    });

    it('should check', async() => {
        let minChampStake = 10;
        await hordConfiguration.connect(hordCongress).setMinChampStake(minChampStake);
        expect(await hordConfiguration.minChampStake())
            .to.be.equal(minChampStake);
    });

    it('should check', async() => {
        let maxWarumPeriod = 10;
        await hordConfiguration.connect(hordCongress).setMaxWarmupPeriod(maxWarumPeriod);
        expect(await hordConfiguration.maxWarmupPeriod())
            .to.be.equal(maxWarumPeriod);
    });

    it('should check', async() => {
        let maxFollowerOnboardPeriod = 10;
        await hordConfiguration.connect(hordCongress).setMaxFollowerOnboardPeriod(maxFollowerOnboardPeriod);
        expect(await hordConfiguration.maxFollowerOnboardPeriod())
            .to.be.equal(maxFollowerOnboardPeriod);
    });

    it('should check', async() => {
        let minFollowerUSDStake = 10;
        await hordConfiguration.connect(hordCongress).setMinFollowerUSDStake(minFollowerUSDStake);
        expect(await hordConfiguration.minFollowerUSDStake())
            .to.be.equal(minFollowerUSDStake);
    });

    it('should check', async() => {
        let maxFollowerUSDStake = 10;
        await hordConfiguration.connect(hordCongress).setMaxFollowerUSDStake(maxFollowerUSDStake);
        expect(await hordConfiguration.maxFollowerUSDStake())
            .to.be.equal(maxFollowerUSDStake);
    });

    it('should check', async() => {
        let minStakePerPoolTicket = 10;
        await hordConfiguration.connect(hordCongress).setMinStakePerPoolTicket(minStakePerPoolTicket);
        expect(await hordConfiguration.minStakePerPoolTicket())
            .to.be.equal(minStakePerPoolTicket);
    });

    it('should check', async() => {
        let assetUtilizationRatio = 10;
        await hordConfiguration.connect(hordCongress).setAssetUtilizationRatio(assetUtilizationRatio);
        expect(await hordConfiguration.assetUtilizationRatio())
            .to.be.equal(assetUtilizationRatio);
    });

    it('should check', async() => {
        let gasUtilizationRatio = 10;
        await hordConfiguration.connect(hordCongress).setGasUtilizationRatio(gasUtilizationRatio);
        expect(await hordConfiguration.gasUtilizationRatio())
            .to.be.equal(gasUtilizationRatio);
    });

    it('should check', async() => {
        let platformStakeRatio = 10;
        await hordConfiguration.connect(hordCongress).setPlatformStakeRatio(platformStakeRatio);
        expect(await hordConfiguration.platformStakeRatio())
            .to.be.equal(platformStakeRatio);
    });

    it('should check', async() => {
        let percentPrecision = 10;
        await hordConfiguration.connect(hordCongress).setPercentPrecision(percentPrecision);
        expect(await hordConfiguration.percentPrecision())
            .to.be.equal(percentPrecision);
    });

    it('should check', async() => {
        let maxSupplyHPoolToken = 10;
        await hordConfiguration.connect(hordCongress).setMaxSupplyHPoolToken(maxSupplyHPoolToken);
        expect(await hordConfiguration.maxSupplyHPoolToken())
            .to.be.equal(maxSupplyHPoolToken);
    });

    it('should check', async() => {
        let maxUSDAllocationPerTicket = 10;
        await hordConfiguration.connect(hordCongress).setMaxUSDAllocationPerTicket(maxUSDAllocationPerTicket);
        expect(await hordConfiguration.maxUSDAllocationPerTicket())
            .to.be.equal(maxUSDAllocationPerTicket);
    });


});