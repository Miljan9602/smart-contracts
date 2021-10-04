const {
    address
} = require('./ethereum');
const hre = require("hardhat");
let configuration = require('../deployments/deploymentConfig.json');
const { ethers, expect } = require('./setup')

let DOMAIN_SEPARATOR;
let config;
let accounts, owner, ownerAddr, user, userAddr;
let signatureValidaotr;

async function setupContractAndAccounts () {
    config = configuration[hre.network.name];

    accounts = await ethers.getSigners()
    owner = accounts[0]
    ownerAddr = await owner.getAddress()
    user = accounts[3]
    userAddr = await user.getAddress()

    const SignatureValidator = await ethers.getContractFactory("SignatureValidator");
    signatureValidaotr = await SignatureValidator.deploy();
    await signatureValidaotr.deployed();

}

describe('Hord-Signatures', async() => {

    before('setup contracts', async () => {
        await setupContractAndAccounts();
        DOMAIN_SEPARATOR = await signatureValidaotr.DOMAIN_SEPARATOR();
    });

    it('should', async() => {
        let a = await signatureValidaotr.recoverSignatureBuyOrderRatio([address(2), 13],"0x7465737400000000000000000000000000000000000000000000000000000000",
            "0x7465737400000000000000000000000000000000000000000000000000000021", 2);
        console.log(a);
    });


});
