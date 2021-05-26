const hre = require("hardhat");
const { getSavedContractAddresses} = require('./utils')
let c = require('../deployments/deploymentConfig.json');

async function main() {
    await hre.run('compile');
    const config = c[hre.network.name];
    const contracts = getSavedContractAddresses()[hre.network.name];
    let admin = await upgrades.admin.getInstance();
    console.log(contracts["HordCongress"]);
    await admin.transferOwnership(contracts["HordCongress"]);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
