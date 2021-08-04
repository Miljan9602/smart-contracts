const hre = require("hardhat");
const { toHordDenomination } = require('../test/setup');
const { getSavedContractAddresses, saveContractAddress, saveContractProxies, getSavedContractProxies } = require('./utils');
let c = require('../deployments/deploymentConfig.json');


async function main() {
    await hre.run('compile');
    const config = c[hre.network.name];
    const contracts = getSavedContractAddresses()[hre.network.name];
    const contractProxies = getSavedContractProxies()[hre.network.name];

    const HordConfiguration = await hre.ethers.getContractFactory('HordConfiguration');
    const hordConfiguration = await upgrades.deployProxy(HordConfiguration, [
        contracts["HordCongress"],
        contractProxies["MaintainersRegistry"],
        toHordDenomination(config.minChampStake),
        config.maxWarmupPeriod,
        config.maxFollowerOnboardPeriod,
        toHordDenomination(config.minFollowerEthStake),
        toHordDenomination(config.maxFollowerEthStake),
        toHordDenomination(config.minStakePerPoolTicket),
        config.assetUtilizationRatio,
        config.gasUtilizationRatio,
        config.platformStakeRatio,
        toHordDenomination(config.maxSupplyHPoolToken),
    ]);
    await hordConfiguration.deployed();
    console.log('Hord Configuration Proxy is deployed to: ', hordConfiguration.address);
    saveContractProxies(hre.network.name, 'HordConfigurationProxy', hordConfiguration.address);


    const HordTreasury = await hre.ethers.getContractFactory('HordTreasury');
    const hordTreasury = await upgrades.deployProxy(HordTreasury, [
        contracts["HordCongress"],
        config.maintainers
    ]);
    await hordTreasury.deployed();
    console.log('Hord Treasury Proxy is deployed to:', hordTreasury.address);
    saveContractProxies(hre.network.name, 'HordTreasuryProxy', hordTreasury.address);


    const HordFactory = await hre.ethers.getContractFactory('HordFactory');
    const hordFactory = await upgrades.deployProxy(HordFactory, [
        contracts["HordCongress"],
        config.maintainers
    ]);
    await hordFactory.deployed();
    console.log('Hord Factory Proxy is deployed to:', hordFactory.address);
    saveContractProxies(hre.network.name, 'HordFactoryProxy', hordFactory.address);


    const HPoolManager = await hre.ethers.getContractFactory('HPoolManager');
    const hPoolManager = await upgrades.deployProxy(HPoolManager, [
            config.maintainers,
            contracts["HordCongress"],
            contractProxies["HordTicketFactory"],
            hordTreasury.address,
            contracts["HordToken"],
            hordFactory.address,
            contracts["AggregatorV3Interface"],
            hordConfiguration.address,
    ]);
    await hPoolManager.deployed();
    console.log('Hord Factory Proxy is deployed to:', hPoolManager.address);
    saveContractProxies(hre.network.name, 'HordFactoryProxy', hordFactory.address);





}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
