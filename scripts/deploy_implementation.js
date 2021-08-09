const hre = require("hardhat");
const { saveContractAddress} = require('./utils')

async function main() {
    await hre.run('compile');

    const HPoolManager = await hre.ethers.getContractFactory('HPoolManager');
    const hPoolManager = await HPoolManager.deploy();
    await hPoolManager.deployed();
    console.log('New HPoolManager implementation: ', hPoolManager.address);
    saveContractAddress(hre.network.name, 'HPoolManager', hPoolManager.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
