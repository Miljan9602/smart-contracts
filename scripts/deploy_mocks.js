const hre = require("hardhat");
const { saveContractAddress} = require('./utils')

async function main() {
    await hre.run('compile');

    const MockAggregatorV3Interface = await hre.ethers.getContractFactory('MockAggregatorV3Interface');
    const mockAggregatorV3Interface = await MockAggregatorV3Interface.deploy();
    await mockAggregatorV3Interface.deployed();
    console.log('Mock aggregator V3 interface deployed to: ', mockAggregatorV3Interface.address);
    saveContractAddress(hre.network.name, 'AggregatorV3Interface', mockAggregatorV3Interface.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
