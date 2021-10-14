const {
    address
} = require('./ethereum');
const hre = require("hardhat");
let configuration = require('../deployments/deploymentConfig.json');
const { ethers, expect } = require('./setup');

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

const sendAsync = (payload) =>
    new Promise((resolve, reject) => {
        hre.web3.currentProvider.send(payload, (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res.result);
            }
        });
    });

async function invalidSignature() {
    let result = "0x196bc98ba48f6880183a85e2fccfb8475ba27451804be8d7327426c92b1b47c4bf7ec98258a405fcdb6e87da36f3d26f4de98e299f6ce8e02ab403ffc787d481b4"

    signature = result.substring(2);
    r = `0x${signature.substring(0, 64)}`;
    s = `0x${signature.substring(64, 128)}`;
    v = parseInt(signature.substring(128, 130), 16);
    v = v < 27 ? v + 27 : v;
}

async function getSignature(message, type, primaryType) {

    const data = {
        domain: {
            name: 'Hord.app',
            version: '1',
            chainId: 3,
            verifyingContract: signatureValidator.address.toString(),
        },
        message,
        ...primaryType,
        types: {
            EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
                { name: 'verifyingContract', type: 'address' },
            ],
            ...type,
        },
    };

    const msgParams = JSON.stringify(data);
    const from = ownerAddr;
    const params = [from, msgParams];
    const method = 'eth_signTypedData_v4';

    const res = await sendAsync(
        {
            method,
            params,
            from
        }
    );

    const signature = res.substring(2);

    r = `0x${ signature.substring(0, 64)}`;
    s = `0x${ signature.substring(64, 128)}`;
    v = parseInt(signature.substring(128, 130), 16);

    v = v < 27 ? v + 27 : v;

    return {
        r,
        s,
        v
    };
}

describe('HordSignatures', async() => {
    describe('Valid signature', async() => {

        before('setup contracts', async () => {
            await setupContractAndAccounts();
            DOMAIN_SEPARATOR = await signatureValidator.DOMAIN_SEPARATOR();
        });

        describe('HordSignatures:: BuyOrderRatio', async() => {
            it('should check if return value is correct value in recoverSignatureBuyOrderRatio function', async() => {
                let messageJSON = {
                    dstToken: tokenAAddrs.toString(),
                    ratio: '50'
                };
                let message = eval(messageJSON);

                let type = {
                    BuyOrderRatio: [
                        { name: 'dstToken', type: 'address' },
                        { name: 'ratio', type: 'uint256' },
                    ],
                };

                let primaryType = {
                    primaryType: 'BuyOrderRatio',
                };

                signature = await getSignature(message, type, primaryType);
                recoveredAddress = await signatureValidator.recoverSignatureBuyOrderRatio([tokenAAddrs.toString(), 50], r, s, v);
                expect(recoveredAddress)
                   .to.equal(ownerAddr);
            });
        });

        describe('HordSignatures:: TradeOrder', async() => {
            it('should check if return value is correct value in recoverSignatureTradeOrder function', async() => {
                let messageJSON = {
                    srcToken: tokenAAddrs.toString(),
                    dstToken: tokenBAddr.toString(),
                    amountSrc: '100'
                };
                let message = eval(messageJSON);

                let type = {
                    TradeOrder: [
                        { name: 'srcToken', type: 'address' },
                        { name: 'dstToken', type: 'address' },
                        { name: 'amountSrc', type: 'uint256' },
                    ],
                };

                let primaryType = {
                    primaryType: 'TradeOrder',
                };

                signature = await getSignature(message, type, primaryType);
                recoveredAddress = await signatureValidator.recoverSignatureTradeOrder([tokenAAddrs.toString(), tokenBAddr.toString(), 100], r, s, v);
                expect(recoveredAddress)
                    .to.equal(ownerAddr);
            });
        });

        describe('HordSignatures:: SellLimit', async() => {
            it('should check if return value is correct value in recoverSignatureSellLimit function', async() => {
                let messageJSON = {
                    srcToken: tokenAAddrs.toString(),
                    dstToken: tokenBAddr.toString(),
                    priceUSD: '100',
                    amountSrc: '100',
                    validUntil: '100',
                };
                let message = eval(messageJSON);

                let type = {
                    SellLimit: [
                        { name: 'srcToken', type: 'address' },
                        { name: 'dstToken', type: 'address' },
                        { name: 'priceUSD', type: 'uint256' },
                        { name: 'amountSrc', type: 'uint256' },
                        { name: 'validUntil', type: 'uint256' },
                    ],
                };

                let primaryType = {
                    primaryType: 'SellLimit',
                };

                signature = await getSignature(message, type, primaryType);
                recoveredAddress = await signatureValidator.recoverSignatureSellLimit([tokenAAddrs.toString(), tokenBAddr.toString(), 100, 100, 100], r, s, v);
                expect(recoveredAddress)
                    .to.equal(ownerAddr);
            });
        });

        describe('HordSignatures:: BuyLimit', async() => {
            it('should check if return value is correct in recoverSignatureBuyLimit function', async() => {
                let messageJSON = {
                    srcToken: tokenAAddrs.toString(),
                    dstToken: tokenBAddr.toString(),
                    priceUSD: '100',
                    amountUSD: '100',
                    validUntil: '100',
                };
                let message = eval(messageJSON);

                let type = {
                    BuyLimit: [
                        { name: 'srcToken', type: 'address' },
                        { name: 'dstToken', type: 'address' },
                        { name: 'priceUSD', type: 'uint256' },
                        { name: 'amountUSD', type: 'uint256' },
                        { name: 'validUntil', type: 'uint256' },
                    ],
                };

                let primaryType = {
                    primaryType: 'BuyLimit',
                };

                signature = await getSignature(message, type, primaryType);
                recoveredAddress = await signatureValidator.recoverSignatureBuyLimit([tokenAAddrs.toString(), tokenBAddr.toString(), 100, 100, 100], r, s, v);
                expect(recoveredAddress)
                    .to.equal(ownerAddr);
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


