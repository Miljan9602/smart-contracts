const hre = require("hardhat");
let c = require('../deployments/deploymentConfig.json');
const { getSavedContractAddresses, getSavedContractProxies, getSavedContractProxyAbis } = require('./utils');
const { toHordDenomination } = require('../test/setup');


async function main() {

    await hre.run('compile');
    const config = c[hre.network.name];
    const contracts = getSavedContractAddresses()[hre.network.name];
    const proxies = getSavedContractProxies()[hre.network.name];
    const adminAbi = getSavedContractProxyAbis()['ProxyAdmin'];

    console.log(proxies["ProxyAdmin"], proxies['HPoolManager'], contracts['HPoolManager'])
    const admin = await hre.ethers.getContractAt(adminAbi, proxies['ProxyAdmin']);
    await admin.upgrade(proxies['HPoolManager'], contracts['HPoolManager']);
}

main();
