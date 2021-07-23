const hre = require("hardhat");
const { toHordDenomination } = require('../test/setup');
const { saveContractAbiTest } = require('./utils');
let c = require('../deployments/deploymentConfig.json');


async function main() {
    await hre.run('compile');

    saveContractAbiTest(hre.network.name, 'HordTicketManager', (await hre.artifacts.readArtifact("HordTicketManager")).abi)
    saveContractAbiTest(hre.network.name, 'HordTicketFactory', (await hre.artifacts.readArtifact("HordTicketFactory")).abi)
    saveContractAbiTest(hre.network.name, 'HPool', (await hre.artifacts.readArtifact("HPool")).abi)
    saveContractAbiTest(hre.network.name, 'HPoolManager', (await hre.artifacts.readArtifact("HPoolManager")).abi)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
