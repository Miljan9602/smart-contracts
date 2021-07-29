const {
    address,
    encodeParameters
} = require('../ethereum');
const hre = require("hardhat");
let configuration = require('../../deployments/deploymentConfig.json');
const { ethers, expect, isEthException, awaitTx, toHordDenomination, hexify } = require('../setup')

let config;
let hordCongress, hordCongressMembersRegistry, hordToken, accounts, owner, ownerAddr, anotherAccount, anotherAccountAddr, r
let nonCongressAcc, nonCongressAccAddr
let initialMembers, initialNames
let tokensToTransfer = 1000;
let targets, values, signatures, calldatas, description, proposalId, numberOfProposals
let minimumQuorum = 3
let zeroValue = 0
let congressAcc, congressAddr
let targetMemberAcc, targetMemberAddr
const targetMemberName = "0x7465737400000000000000000000000000000000000000000000000000000000";

const zeroAddress = "0x000000000000000000000000000000000000000000"

async function setupContractAndAccounts () {
    config = configuration[hre.network.name];

    accounts = await ethers.getSigners()
    owner = accounts[0]
    ownerAddr = await owner.getAddress()
    anotherAccount = accounts[8]
    anotherAccountAddr = await anotherAccount.getAddress()
    nonCongressAcc = accounts[9]
    nonCongressAccAddr = await nonCongressAcc.getAddress()
    congressAcc = accounts[5]
    congressAddr = await  congressAcc.getAddress()
    targetMemberAcc = accounts[4]
    targetMemberAddr = await  targetMemberAcc.getAddress()


    const HordCongress = await hre.ethers.getContractFactory("HordCongress");
    hordCongress = await HordCongress.deploy();
    await hordCongress.deployed();

    initialMembers = [ownerAddr.toString().toLowerCase(), anotherAccountAddr.toString().toLowerCase()];
    initialNames = hexify(['Nikola', 'eiTan']);

    const HordCongressMembersRegistry = await hre.ethers.getContractFactory("HordCongressMembersRegistry");
    hordCongressMembersRegistry = await HordCongressMembersRegistry.deploy(
        initialMembers,
        initialNames,
        congressAddr
    );

    await hordCongressMembersRegistry.deployed();
    await hordCongress.setMembersRegistry(hordCongressMembersRegistry.address);

    const Hord = await hre.ethers.getContractFactory("HordToken");
    hordToken = await Hord.deploy(
        config.hordTokenName,
        config.hordTokenSymbol,
        toHordDenomination(config.hordTotalSupply.toString()),
        hordCongress.address
    );
    await hordToken.deployed()
    hordToken = hordToken.connect(owner)
}

describe('Governance', () => {
    before('setup contracts', async () => {
        await setupContractAndAccounts();
    });

    describe('HordCongressMembersRegistry::setup',async() => {
        describe('initial constructor setup', async() => {
            it('should check number of initial members', async() => {
                const numberOfMembers = await hordCongressMembersRegistry.getNumberOfMembers();
                expect(parseInt(numberOfMembers.toString())).to.be.equal(initialMembers.length);
            });

            it('should check addresses of initial members', async() => {
               let allMembers = await hordCongressMembersRegistry.getAllMemberAddresses();
               for(let i=0 ; i<allMembers.length; i++) {
                   expect(allMembers[i].toLowerCase()).to.be.equal(initialMembers[i].toLowerCase());
               }
            });

            it('should check that minimal quorum is correctly set', async() => {
                let minimalQuorum = await hordCongressMembersRegistry.getMinimalQuorum();
                expect(parseInt(minimalQuorum.toString())).to.be.equal(initialMembers.length-1);
            })
        })
    });

    describe('HordCongress::setup', async() => {
       it('should check that congress members registry address is set properly', async() => {
           let congressMembersRegistry = await hordCongress.getMembersRegistry();
           expect(congressMembersRegistry.toLowerCase()).to.be.equal(hordCongressMembersRegistry.address.toLowerCase())
       })
    });

    describe('HordCongress::propose', async() => {

        it('should setup proposal information', async() => {
            targets = [hordToken.address];
            values = ["0"];
            signatures = ["transfer(address,uint256)"];
            calldatas = [encodeParameters(['address','uint256'], [anotherAccountAddr, toHordDenomination(tokensToTransfer)])];
            description = `Transfer ${tokensToTransfer} tokens from HordCongress to ${anotherAccountAddr}`;
        })

        describe('Should NOT be able to propose from non-congress member', async() => {
            it('should fail on trying to propose', async() => {
                expect(
                    await isEthException(hordCongress.connect(nonCongressAcc).propose(targets, values, signatures, calldatas, description))
                ).to.be.true
            })
        });

        describe('Should BE able to propose from congress member', async() => {
            it(`should create a proposal to transfer ${tokensToTransfer} tokens from Congress`, async() => {
                r = await awaitTx(hordCongress.propose(targets, values, signatures, calldatas, description));
            });

            it('should check ProposalCreated event', async() => {
                proposalId = parseInt(r.events[0].args.id);
                expect(r.events.length).to.equal(1)
                expect(r.events[0].event).to.equal('ProposalCreated')
                expect(r.events[0].args.proposer).to.equal(ownerAddr)
                expect(r.events[0].args.description).to.equal(description)
            });

            it('should check proposal id is properly incrementing', async() => {
                numberOfProposals = await hordCongress.proposalCount();
                expect(proposalId).to.be.equal(numberOfProposals);
            });
        });

        describe('Should BE able to vote on submitted proposal', async() => {
            it(`should vote on proposal`, async() => {
                r = await awaitTx(hordCongress.castVote(proposalId, true));
            });

            it(`should vote from ${anotherAccountAddr} for proposal`, async() => {
                r = await awaitTx(hordCongress.connect(anotherAccount).castVote(proposalId, true));
            });

            it('should execute proposal', async() => {
                r = await awaitTx(hordCongress.execute(proposalId));
                expect(r.events.length).to.equal(3);
                expect(r.events[2].event).to.equal('ProposalExecuted');
            });
        });

    });

    describe('HordCongress functions', async () => {
        xit('should not let to pass zeroAddress in setMembersRegistry function', async () => {
            await expect(hordCongress.connect(congressAcc).setMembersRegistry(zeroAddress))
                .to.be.reverted;
            //await expect(hordCongress.connect(congressAcc).setMembersRegistry(zeroAddress))
              //  .to.be.reverted;
        });

        xit('should check before/after values after getActions function', async() => {

        });

        it('should ', async() => {

        });
    });

    describe('HordCongressMembersRegistry functions', async() => {
        it('shoud not let nonCongressAcc to call changeMinimumQuorum function', async () => {
           await expect(hordCongressMembersRegistry.connect(nonCongressAcc).changeMinimumQuorum(minimumQuorum))
               .to.be.reverted;
        });

        it('should not let to changeMinimumQuorum with value 0', async () => {
            await expect(hordCongressMembersRegistry.connect(congressAcc).changeMinimumQuorum(zeroValue))
                .to.be.reverted;
        });

        it('should check before/after values after changeMinimumQuorum function', async () => {
            await hordCongressMembersRegistry.connect(congressAcc).changeMinimumQuorum(minimumQuorum);
            expect(await hordCongressMembersRegistry.connect(congressAcc).getMinimalQuorum())
                .to.be.equal(minimumQuorum);
        });

        it('should not let nonCongressAcc to call addMember function', async () => {
            await expect(hordCongressMembersRegistry.connect(nonCongressAcc)
                .addMember(targetMemberAcc, targetMemberName))
                .to.be.reverted;
        });

        // must to rename variables
        it('should let CongressAcc to call addMember function', async () => {
            await hordCongressMembersRegistry.connect(congressAcc)
                .addMember(targetMemberAddr, targetMemberName);
            const arr = await hordCongressMembersRegistry.connect(congressAcc).getAllMemberAddresses();
            const len = await hordCongressMembersRegistry.connect(congressAcc).getNumberOfMembers();
            const a = arr[len - 1];
            expect(targetMemberAddr)
                .to.equal(a);
        });

        it('should not let to add member who is already a member of congress in addMemberInternal function', async () => {
            await expect(hordCongressMembersRegistry.connect(congressAcc)
                .addMember(targetMemberAddr, targetMemberName))
                .to.be.reverted;
        });

        it('should not let nonCongressAcc to call removeMember function', async () => {
            await expect(hordCongressMembersRegistry.connect(nonCongressAcc).removeMember(targetMemberAddr))
                .to.be.reverted;
        });

        it('should not let to remove member who is already a member of congress in removeMember function', async () => {
            await expect(hordCongressMembersRegistry.connect(congressAcc)
                .removeMember(nonCongressAccAddr))
                .to.be.reverted;
        });

        // check more values
        it('should check before/after values after removeMember function', async() => {
            await hordCongressMembersRegistry.connect(congressAcc)
                .addMember(nonCongressAccAddr, "0x2555737400000000000000000000000000000000000000000000000000000000");
            await hordCongressMembersRegistry.connect(congressAcc).removeMember(nonCongressAccAddr);
            expect(await hordCongressMembersRegistry.connect(congressAcc).isMember(nonCongressAccAddr))
                .to.equal(false);
        });

        it('should not let to pass zeroAdress in getMemberInfo function', async() => {
            await expect(hordCongressMembersRegistry.connect(congressAcc).getMemberInfo(zeroAddress))
                .to.be.reverted;
        });

        //check for time
        it('should check before/after values after getMemberInfo function', async() => {
            const resp = await hordCongressMembersRegistry.connect(congressAcc).getMemberInfo(targetMemberAddr);
            expect(resp[0])
                .to.equal(targetMemberAddr);
            expect((resp[1]))
                .to.equal(targetMemberName);
        });

    });


});
