const hre = require("hardhat");
const { saveContractAddress } = require('./utils');

async function main() {
    await hre.run('compile');

    const SignatureValidator = await hre.ethers.getContractFactory("SignatureValidator");
    const signatureValidator = await SignatureValidator.deploy();
    await signatureValidator.deployed();
    console.log("SignatureValidator contract deployed to:", signatureValidator.address);
    saveContractAddress(hre.network.name, 'SignatureValidator', signatureValidator.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
