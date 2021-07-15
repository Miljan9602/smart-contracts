const hre = require("hardhat");
const { saveContractAddress} = require('./utils')

async function main() {
    await hre.run('compile');

    const HordTicketFactory = await hre.ethers.getContractFactory('HordTicketFactory');
    const hordTicketFactory = await HordTicketFactory.deploy();
    await hordTicketFactory.deployed();

    saveContractAddress(hre.network.name, 'HordTicketFactory', hordTicketFactory.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
