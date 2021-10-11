const {
    address
} = require('./ethereum');
const hre = require("hardhat");
let configuration = require('../deployments/deploymentConfig.json');
const { ethers, expect, BigNumber } = require('./setup');
const util = require('ethereumjs-util');

let DOMAIN_SEPARATOR;
let config;
let accounts, owner, ownerAddr, tokenA, tokenAAddrs, tokenB, tokenBAddr;
let signatureValidator;
let recoveredAddress, signature;
let r, s, v;

async function setupContractAndAccounts () {
    config = configuration[hre.network.name];

    accounts = await ethers.getSigners()
    owner = accounts[0]
    ownerAddr = await owner.getAddress()
    tokenA = accounts[1];
    tokenAAddrs = await tokenA.getAddress()
    tokenB = accounts[2];
    tokenBAddr = await tokenB.getAddress()

    const SignatureValidator = await ethers.getContractFactory("SignatureValidator");
    signatureValidator = await SignatureValidator.deploy();
    await signatureValidator.deployed();

}

async function getSignature(message, primaryType, type) {

    // const data = {
    //     domain: {
    //         chainId: 3,
    //         name: 'TestApp1',
    //         verifyingContract: '',
    //         version: '1',
    //     },
    //     message,
    //     primaryType,
    //     types: {
    //         EIP712Domain: [
    //             { name: 'name', type: 'string' },
    //             { name: 'version', type: 'string' },
    //             { name: 'chainId', type: 'uint256' },
    //             { name: 'verifyingContract', type: 'address' },
    //         ],
    //         ...type,
    //     },
    // };
    //
    //
    // const msgParams = JSON.stringify(data);
    // const from = owner;
    // const params = [from, msgParams];
    // const method = 'eth_signTypedData_v4';
    // const result = await sendAsync({
    //     method,
    //     params,
    //     from,
    // });
    //
    // signature = result.substring(2);
    // r = `0x${signature.substring(0, 64)}`;
    // s = `0x${signature.substring(64, 128)}`;
    // v = parseInt(signature.substring(128, 130), 16);
    // v = v < 27 ? v + 27 : v;

    // const hexPrivateKey = "0xae78c8b502571dba876742437f8bc78b689cf8518356c0921393d89caaf284ce";
    // const signingKey = new ethers.utils.SigningKey(hexPrivateKey);
    // const digest = ethers.utils.id("message");
    // signature = signingKey.signDigest(digest);
    // const joinedSignature = ethers.utils.joinSignature(signature);
    // recoveredAddress = ethers.utils.recoverAddress(digest, signature);
    //
    // r = signature.r;
    // s = signature.s;
    // v = signature.v;
    //
    // console.log(r);
    // console.log(s);
    // console.log(v);


    let Example = require('/home/srdjan/Desktop/hord/smart-contracts/test/hord-signatures.js')

    let Web3 = require('web3')
    let web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))

    contract('Example', (accounts) => {
        let address = accounts[0]

        it('ecrecover result matches address', async function() {
            let instance = await Example.deployed()
            let msg = '0x8CbaC5e4d803bE2A3A5cd3DbE7174504c6DD0c1C'

            let h = web3.sha3(msg)
            let sig = web3.eth.sign(address, h).slice(2)
            let r = `0x${sig.slice(0, 64)}`
            let s = `0x${sig.slice(64, 128)}`
            let v = web3.toDecimal(sig.slice(128, 130)) + 27

            let result = await instance.testRecovery.call(h, v, r, s)
            assert.equal(result, address)
        })
    })

    // const pubKey = util.ecrecover(signature.v, signature.r, signature.s);
    // console.log(pubKey);
}

async function invalidSignature() {
    let result = "0x196bc98ba48f6880183a85e2fccfb8475ba27451804be8d7327426c92b1b47c4bf7ec98258a405fcdb6e87da36f3d26f4de98e299f6ce8e02ab403ffc787d481b4"

    signature = result.substring(2);
    r = `0x${signature.substring(0, 64)}`;
    s = `0x${signature.substring(64, 128)}`;
    v = parseInt(signature.substring(128, 130), 16);
    v = v < 27 ? v + 27 : v;
}

describe('HordSignatures', async() => {

    before('setup contracts', async () => {
        await setupContractAndAccounts();
        DOMAIN_SEPARATOR = await signatureValidator.DOMAIN_SEPARATOR();
    });

    describe('Valid signature', async() => {

        before('Sign transaction', async() => {
            await getSignature();
        });

        describe('HordSignatures:: BuyOrderRatio', async() => {
            it('should check if return value is correct value in recoverSignatureBuyOrderRatio function', async() => {
                recoveredAddress = await signatureValidator.recoverSignatureBuyOrderRatio([tokenAAddrs, 2], r, s, v);
                console.log(recoveredAddress);
            });
        });

        describe('HordSignatures:: TradeOrder', async() => {
            it('should check if return value is correct value in recoverSignatureTradeOrder function', async() => {
                recoveredAddress = await signatureValidator.recoverSignatureTradeOrder([tokenAAddrs, tokenBAddr, 10], r, s, v);
                console.log(recoveredAddress);
            });
        });

        describe('HordSignatures:: SellLimit', async() => {
            it('should check if return value is correct value in recoverSignatureSellLimit function', async() => {
                recoveredAddress = await signatureValidator.recoverSignatureSellLimit([tokenAAddrs, tokenBAddr, 100, 10, 10000], r, s, v);
                console.log(recoveredAddress);
            });
        });

        describe('HordSignatures:: BuyLimit', async() => {
            it('should check if return value is correct in recoverSignatureBuyLimit function', async() => {
                recoveredAddress = await signatureValidator.recoverSignatureBuyLimit([tokenAAddrs, tokenBAddr, 100, 10, 10000], r, s, v);
                console.log(recoveredAddress);
            });
        });
    });

    describe('Invalid signatures', async() => {
        before('Sign transaction', async() => {
            await invalidSignature();
        });

        describe('HordSignatures:: BuyOrderRatio', async() => {
            it('should check if return values is 0x0 address in recoverSignatureBuyOrderRatio function', async() => {
                recoveredAddress = await signatureValidator.recoverSignatureBuyOrderRatio([tokenAAddrs, 2], r, s, v);
                expect(recoveredAddress)
                    .to.be.equal(address(0));
            });
        });

        describe('HordSignatures:: TradeOrder', async() => {
            it('should check if return values is 0x0 address in recoverSignatureTradeOrder function', async() => {
                recoveredAddress = await signatureValidator.recoverSignatureTradeOrder([tokenAAddrs, tokenBAddr, 10], r, s, v);
                expect(recoveredAddress)
                    .to.be.equal(address(0));
            });
        });

        describe('HordSignatures:: SellLimit', async() => {
            it('should check if return values is 0x0 address in recoverSignatureSellLimit function', async() => {
                recoveredAddress = await signatureValidator.recoverSignatureSellLimit([tokenAAddrs, tokenBAddr, 100, 10, 10000], r, s, v);
                expect(recoveredAddress)
                    .to.be.equal(address(0));
            });
        });

        describe('HordSignatures:: BuyLimit', async() => {
            it('should check if return values is 0x0 address in recoverSignatureBuyLimit function', async() => {
                recoveredAddress = await signatureValidator.recoverSignatureBuyLimit([tokenAAddrs, tokenBAddr, 100, 10, 10000], r, s, v);
                expect(recoveredAddress)
                    .to.be.equal(address(0));
            });
        });
    });

});
