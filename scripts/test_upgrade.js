const hre = require("hardhat");
let c = require('../deployments/deploymentConfig.json');
const { getSavedContractAddresses, getSavedContractProxies } = require('./utils');
const { toHordDenomination } = require('../test/setup');


async function main() {

    await hre.run('compile');
    const config = c[hre.network.name];
    const contracts = getSavedContractAddresses()[hre.network.name];
    const proxies = getSavedContractProxies()[hre.network.name];


    // Upgrading
    const HordTicketManager = await ethers.getContractFactory("HordTicketManager");
    const upgraded = await upgrades.upgradeProxy(proxies['HordTicketManager'], HordTicketManager);
    const implementation = upgraded.implementation();
    const admin = await upgrades.admin.getInstance();
    const owner = await admin.owner();

    console.log('New implementation', implementation);
    console.log('Admin', admin.address);
    console.log('Current owner', owner);
}

main();
