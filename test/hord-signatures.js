const {
    address
} = require('./ethereum');
const hre = require("hardhat");
let configuration = require('../deployments/deploymentConfig.json');
const { ethers, expect } = require('./setup');
const util = require('ethereumjs-util')


let DOMAIN_SEPARATOR;
let config;
let accounts, owner, ownerAddr, tokenA, tokenAAddrs, tokenB, tokenBAddr;
let signatureValidator;
let r, s, v;
let recoveredAddress;

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

async function getSignature(message, type, primaryType) {

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
    // const signature = result.substring(2);
    // const r = `0x${signature.substring(0, 64)}`;
    // const s = `0x${signature.substring(64, 128)}`;
    // let v = parseInt(signature.substring(128, 130), 16);
    // v = v < 27 ? v + 27 : v;

    const hexPrivateKey = "0xae78c8b502571dba876742437f8bc78b689cf8518356c0921393d89caaf284ce";
    const signingKey = new ethers.utils.SigningKey(hexPrivateKey);
    const digest = ethers.utils.id("Some message");
    const signature = signingKey.signDigest(digest);
    const joinedSignature = ethers.utils.joinSignature(signature);
    recoveredAddress = ethers.utils.recoverAddress(digest, signature);

    //const pubKey = util.ecrecover(new Buffer('aaa'), signature.v, signature.r, signature.s);


    console.log(pubKey);

    r = signature.r;
    s = signature.s;
    v = signature.v;

    console.log(r);
    console.log(s);
    console.log(v);

    // const result = "0xa9679464a5f5ee62b51def858199a040af52804eef9f1e05a0645df77953dbb611d6cf7da810fa6626d0aebc785768bb91f746b49b856d95feb3e7c94bfcc86b21"
    // const signature = result.substring(2);
    // r = `0x${signature.substring(0, 64)}`;
    // s = `0x${signature.substring(64, 128)}`;
    // v = parseInt(signature.substring(128, 130), 16);
    // v = v < 27 ? v + 27 : v;
    //
    // console.log(r);
    // console.log(s);
    // console.log(v);

    // var Eth = require('web3-eth');
    // var eth = new Eth(Eth.givenProvider || 'ws://some.local-or-remote.node:8546');
    //
    // var message = 1001
    // var orgmessage = web3.eth.abi.encodeParameter('uint256',message)
    // var orginal = `0xf8e81D47203A594245E36C48e151709F0C19fBe8${orgmessage.slice(2)}`
    // var hash = web3.utils.keccak256(orginal);
    // const accounts = await ethers.getSigners()[0];
    // var signature = await web3.eth.personal.sign(hash, accounts);
    // var sig1 = signature.slice(2)
    // var r = `0x${sig1.slice(0, 64)}`
    // var s = `0x${sig1.slice(64, 128)}`
    // var v = web3.utils.toDecimal(`0x${sig1.slice(128, 130)}`)
    //
    // console.log("h",hash)
    // console.log("v",v)
    // console.log("r",r)
    // console.log("s",s)
}

describe('HordSignatures', async() => {

    before('setup contracts', async () => {
        await setupContractAndAccounts();
        await getSignature();
        DOMAIN_SEPARATOR = await signatureValidator.DOMAIN_SEPARATOR();
    });

    describe('HordSignatures:: BuyOrderRatio', async() => {

        it('should check if return values is 0x0 address in recoverSignatureBuyOrderRatio function', async() => {
            let returnValue = await signatureValidator.recoverSignatureBuyOrderRatio([tokenAAddrs, 2], r, s, v);
            console.log(returnValue);
        });

        it('should check if return values is not correct in recoverSignatureBuyOrderRatio function', async() => {

        });

        it('should check if return value is correct value in recoverSignatureBuyOrderRatio function', async() => {

        });
    });

    // describe('HordSignatures:: TradeOrder', async() => {
    //
    //     it('should check if return values is 0x0 address in recoverSignatureTradeOrder function', async() => {
    //         let returnValue = await signatureValidator.recoverSignatureTradeOrder([tokenAAddrs, tokenBAddr, 10], r, s, v);
    //         console.log(returnValue);
    //     });
    //
    //     it('should check if return values is not correct in recoverSignatureTradeOrder function', async() => {
    //
    //     });
    //
    //     it('should check if return value is correct value in recoverSignatureTradeOrder function', async() => {
    //
    //     });
    // });
    //
    //
    // describe('HordSignatures:: SellLimit', async() => {
    //
    //     it('should check if return values is 0x0 address in recoverSignatureSellLimit function', async() => {
    //         let returnValue = await signatureValidator.recoverSignatureSellLimit([tokenAAddrs, tokenBAddr, 100, 10, 10000], r, s, v);
    //         console.log(returnValue);
    //     });
    //
    //     it('should check if return values is not correct in recoverSignatureSellLimit function', async() => {
    //
    //     });
    //
    //     it('should check if return value is correct value in recoverSignatureSellLimit function', async() => {
    //
    //     });
    // });
    //
    // describe('HordSignatures:: BuyLimit', async() => {
    //
    //     it('should check if return values is 0x0 address in recoverSignatureBuyLimit function', async() => {
    //         let returnValue = await signatureValidator.recoverSignatureBuyLimit([tokenAAddrs, tokenBAddr, 100, 10, 10000], r, s, v);
    //         console.log(returnValue);
    //     });
    //
    //     it('should check if return values is not correct in recoverSignatureBuyLimit function', async() => {
    //
    //     });
    //
    //     it('should check if return value is correct in recoverSignatureBuyLimit function', async() => {
    //
    //     });
    // });

});
