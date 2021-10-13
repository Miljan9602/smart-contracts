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

async function getSignature(contractAddress) {
        const data = {
            domain: {
                chainId: 3,
                // Give a user friendly name to the specific contract you are signing for.
                name: 'TestApp1',
                // If name isn't enough add verifying contract to make sure you are establishing contracts with the proper entity
                verifyingContract: contractAddress.toString(),
                // Just let's you know the latest version. Definitely make sure the field name is correct.
                version: '1',
            },
            message: {
                dstToken: '0xd74d196eccf1c5a5220efff4bb628a4ffd31d870',
                ratio: '50'
            },
            primaryType: 'BuyOrderRatio',
            types: {
                EIP712Domain: [
                    { name: 'name', type: 'string' },
                    { name: 'version', type: 'string' },
                    { name: 'chainId', type: 'uint256' },
                    { name: 'verifyingContract', type: 'address' },
                ],
                BuyOrderRatio: [
                    { name: 'dstToken', type: 'address' },
                    { name: 'ratio', type: 'uint256' },
                ],
            },
        };

        const msgParams = JSON.stringify(data);
        const from = ownerAddr;
        const params = [from, msgParams];
        const method = 'eth_signTypedData_v4';
        console.log(params);

        const res = await sendAsync(
            {
                method,
                params,
                from
            }
        );

        console.log(res);
        const signature = res.substring(2);

        const r = `0x${ signature.substring(0, 64)}`;
        const s = `0x${ signature.substring(64, 128)}`;
        let v = parseInt(signature.substring(128, 130), 16);

        v = v < 27 ? v + 27 : v;

        console.log( {
            res, signature, r, s, v,
        });
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
    describe('Valid signature', async() => {

        before('setup contracts', async () => {
            await setupContractAndAccounts();
            DOMAIN_SEPARATOR = await signatureValidator.DOMAIN_SEPARATOR();
        });

        describe('Sign transaction', async() => {
            const sig = await getSignature(signatureValidator.address);
            console.log(sig);
        });

        describe('HordSignatures:: BuyOrderRatio', async() => {
            it('should check if return value is correct value in recoverSignatureBuyOrderRatio function', async() => {
                recoveredAddress = await signatureValidator.recoverSignatureBuyOrderRatio([tokenAAddrs, 2], r, s, v);
                console.log(recoveredAddress);
            });
        });
        //
        // describe('HordSignatures:: TradeOrder', async() => {
        //     it('should check if return value is correct value in recoverSignatureTradeOrder function', async() => {
        //         recoveredAddress = await signatureValidator.recoverSignatureTradeOrder([tokenAAddrs, tokenBAddr, 10], r, s, v);
        //         console.log(recoveredAddress);
        //     });
        // });
        //
        // describe('HordSignatures:: SellLimit', async() => {
        //     it('should check if return value is correct value in recoverSignatureSellLimit function', async() => {
        //         recoveredAddress = await signatureValidator.recoverSignatureSellLimit([tokenAAddrs, tokenBAddr, 100, 10, 10000], r, s, v);
        //         console.log(recoveredAddress);
        //     });
        // });
        //
        // describe('HordSignatures:: BuyLimit', async() => {
        //     it('should check if return value is correct in recoverSignatureBuyLimit function', async() => {
        //         recoveredAddress = await signatureValidator.recoverSignatureBuyLimit([tokenAAddrs, tokenBAddr, 100, 10, 10000], r, s, v);
        //         console.log(recoveredAddress);
        //     });
        // });
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
