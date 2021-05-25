const {
    address,
    encodeParameters
} = require('./ethereum');
const configuration = require('../deployments/deploymentConfig.json');
const { ethers, expect, isEthException, awaitTx, toHordDenomination, waitForSomeTime } = require('./setup')
const hre = require("hardhat");


let hordCongress, hordCongressAddress, accounts, owner, ownerAddr, maintainer, maintainerAddr,
    user, userAddress, config,
    hordToken, maintainersRegistryContract, ticketFactoryContract, ticketManagerContract,
    championId, supplyToMint, tx, tokenId, lastAddedId, ticketsToBuy, reservedTickets,
    hordBalance, ticketsBalance, amountStaked

async function setupAccounts () {
    config = configuration[hre.network.name];
    let accounts = await ethers.getSigners()
    owner = accounts[0];
    ownerAddr = await owner.getAddress()

    // Mock hord congress
    hordCongress = accounts[7];
    hordCongressAddress = await hordCongress.getAddress();
    // Mock maintainer address
    maintainer = accounts[8]
    maintainerAddr = await maintainer.getAddress()

    user = accounts[9]
    userAddress = await user.getAddress()
}

async function setupContracts () {
    const Hord = await hre.ethers.getContractFactory("HordToken");

    hordToken = await Hord.deploy(
        config.hordTokenName,
        config.hordTokenSymbol,
        toHordDenomination(config.hordTotalSupply.toString()),
        ownerAddr
    );
    await hordToken.deployed()

    hordToken = hordToken.connect(owner)


    const MaintainersRegistry = await ethers.getContractFactory('MaintainersRegistry')
    const maintainersRegistry = await upgrades.deployProxy(MaintainersRegistry, [[maintainerAddr], hordCongressAddress]);
    await maintainersRegistry.deployed()
    maintainersRegistryContract = maintainersRegistry.connect(owner);


    const HordTicketManager = await ethers.getContractFactory('HordTicketManager');
    const hordTicketManager = await upgrades.deployProxy(HordTicketManager, [
            hordCongressAddress,
            maintainersRegistry.address,
            hordToken.address,
            config['minTimeToStake'],
            toHordDenomination(config['minAmountToStake'])
        ]
    );
    await hordTicketManager.deployed()
    ticketManagerContract = hordTicketManager.connect(owner);

    const HordTicketFactory = await ethers.getContractFactory('HordTicketFactory')
    const hordTicketFactory = await upgrades.deployProxy(HordTicketFactory, [
            hordCongressAddress,
            maintainersRegistry.address,
            hordTicketManager.address,
            config["maxFungibleTicketsPerPool"],
            config["uri"]
        ]
    );
    await hordTicketFactory.deployed()

    ticketFactoryContract = hordTicketFactory.connect(maintainer);

    supplyToMint = 20;

    await hordTicketManager.setHordTicketFactory(hordTicketFactory.address);
}

describe('HordTicketFactory & HordTicketManager Test', () => {
    before('setup contracts', async () => {
        await setupAccounts();
        await setupContracts()
    });

    describe('Pause and Unpause contract', async() => {
        it('should NOT be able to pause contract from NON-congress address', async() => {
           ticketFactoryContract = ticketFactoryContract.connect(user);
            expect(
                await isEthException(ticketFactoryContract.pause())
            ).to.be.true
        });

        it('should pause contract from congress', async() => {
            ticketFactoryContract = ticketFactoryContract.connect(hordCongress);
            await ticketFactoryContract.pause();
            expect(await ticketFactoryContract.paused()).to.be.true;
        });

        it('should unpause contract from congress', async() => {
            await ticketFactoryContract.unpause();
            expect(await ticketFactoryContract.paused()).to.be.false;
        });
    });

    describe('Minting from maintainer', async() => {
        it('should mint token', async() => {
            ticketFactoryContract = ticketFactoryContract.connect(maintainer);
            lastAddedId = await ticketFactoryContract.lastMintedTokenId();
            tokenId = parseInt(lastAddedId,10) + 1;
            championId = 1;
            tx = await awaitTx(ticketFactoryContract.mintNewHPoolNFT(tokenId, supplyToMint, championId));
        });

        it('should check MintedNewNFT event', async() => {
            expect(tx.events.length).to.equal(2)
            expect(tx.events[1].event).to.equal('MintedNewNFT')
            expect(parseInt(tx.events[1].args.tokenId)).to.equal(tokenId)
            expect(parseInt(tx.events[1].args.championId)).to.equal(championId)
            expect(parseInt(tx.events[1].args.initialSupply)).to.equal(supplyToMint)
        });

        it('should check that all minted tokens are on TicketManager contract', async () => {
            let balance = await ticketFactoryContract.balanceOf(ticketManagerContract.address, tokenId);
            expect(balance).to.be.equal(supplyToMint);
        })

        it('should check token supply', async() => {
            let tokenSupply = await ticketFactoryContract.getTokenSupply(tokenId);
            expect(parseInt(tokenSupply,10)).to.equal(supplyToMint, "Wrong supply minted.");
        });

        it('should check champion minted ids', async() => {
            let championMintedIds = await ticketManagerContract.getChampionTokenIds(championId);
            expect(parseInt(championMintedIds.slice(-1)[0])).to.equal(championId, "Champion ID does not match.");
        });
    });

    describe('Adding token supply', async() => {
       it('should add token supply within allowed range', async () => {

       });
    });

    describe('Minting from address which is not maintainer', async() => {
       it('should not be able to mint from non-maintainer user', async() => {
           ticketFactoryContract = ticketFactoryContract.connect(user);
           lastAddedId = await ticketFactoryContract.lastMintedTokenId();
           tokenId = parseInt(lastAddedId,10) + 1;
           championId = 1;

           expect(
               await isEthException(ticketFactoryContract.mintNewHPoolNFT(tokenId, supplyToMint, championId))
           ).to.be.true
       });

       it('should not be able to mint non-ordered token id', async() => {
           ticketFactoryContract = ticketFactoryContract.connect(maintainer);
           tokenId = tokenId + 1;
           expect(
               await isEthException(ticketFactoryContract.mintNewHPoolNFT(tokenId, supplyToMint, championId))
           ).to.be.true
       });

       it('should not be able to mint more than max supply', async() => {
           ticketFactoryContract = ticketFactoryContract.connect(maintainer);
           lastAddedId = await ticketFactoryContract.lastMintedTokenId();
           tokenId = parseInt(lastAddedId,10) + 1;
           let _supplyToMint = config["maxFungibleTicketsPerPool"] + 1;
           expect(
               await isEthException(ticketFactoryContract.mintNewHPoolNFT(tokenId, _supplyToMint, championId))
           ).to.be.true
       });
    });

    describe('Staking HORD in order to get tickets', async() => {
        it('should have some hord tokens in order to stake', async() => {
            hordToken = hordToken.connect(owner);
            await hordToken.transfer(userAddress, toHordDenomination(3500));

            let balance = await hordToken.balanceOf(userAddress);
            expect(balance.toString()).to.be.equal(toHordDenomination(3500));
        });

        it('should approve HordTicketManager to take HORD', async () => {
            hordToken = hordToken.connect(user);
            let balance = await hordToken.balanceOf(userAddress);
            await hordToken.approve(ticketManagerContract.address, balance);
        });

        it('should check accounting state before deposit', async() => {
            tokenId = await ticketFactoryContract.lastMintedTokenId();
            reservedTickets = await ticketManagerContract.getAmountOfTicketsReserved(tokenId);
            expect(parseInt(reservedTickets,10)).to.equal(0);
        });

        it('should try to buy 3 tickets', async() => {
            ticketsToBuy = 3;
            ticketManagerContract = ticketManagerContract.connect(user);
            tokenId = await ticketFactoryContract.lastMintedTokenId();
            tx = await awaitTx(ticketManagerContract.stakeAndReserveNFTs(tokenId, ticketsToBuy));
        });

        it('should NOT be able to buy more tickets than user can afford', async() => {
            ticketManagerContract = ticketManagerContract.connect(user);
            tokenId = await ticketFactoryContract.lastMintedTokenId();
            expect(
                await isEthException(ticketManagerContract.stakeAndReserveNFTs(tokenId, 2))
            ).to.be.true
        });

        it('should check event TokensStaked', async() => {
            expect(tx.events.length).to.equal(3)
            expect(tx.events[2].event).to.equal('TokensStaked');
            expect(tx.events[2].args.user).to.equal(userAddress, "User address us not matching")
            expect(tx.events[2].args.amountStaked).to.equal(toHordDenomination(ticketsToBuy * config['minAmountToStake']));
            expect(parseInt(tx.events[2].args.inFavorOfTokenId)).to.equal(tokenId);
            expect(parseInt(tx.events[2].args.numberOfTicketsReserved)).to.equal(ticketsToBuy);
        });

        it('should check amount user is actively staking', async() => {
            amountStaked = await ticketManagerContract.getCurrentAmountStakedForTokenId(userAddress, tokenId);
            expect(amountStaked).to.equal(toHordDenomination(ticketsToBuy * config['minAmountToStake']));
        });

        it('should check number of reserved tickets', async() => {
            reservedTickets = await ticketManagerContract.getAmountOfTicketsReserved(tokenId);
            expect(parseInt(reservedTickets, 10)).to.equal(ticketsToBuy);
        });
    });

    describe('Claiming tickets', async() => {
        it('should NOT BE ABLE claim NFT tickets and withdraw amount staked', async() => {
            ticketManagerContract = ticketManagerContract.connect(user);
            let startIndex = 0;
            let endIndex = await ticketManagerContract.getNumberOfStakesForUserAndToken(userAddress, tokenId);
            tx = await awaitTx(ticketManagerContract.claimNFTs(tokenId, startIndex, endIndex));
            expect(tx.events.length).to.equal(0);
        });

        it('should advance time so user can claim NFTs', async() => {
            await waitForSomeTime(owner.provider, config["minTimeToStake"]);
        });

        it('should get balance of tickets and hord before withdrawal', async() => {
            hordBalance = await hordToken.balanceOf(userAddress);
            ticketsBalance = await ticketFactoryContract.balanceOf(userAddress, tokenId);
            amountStaked = await ticketManagerContract.getCurrentAmountStakedForTokenId(userAddress, tokenId);
            expect(ticketsBalance).to.equal(0);
        });

        it('should claim NFT tickets and withdraw amount staked', async() => {
            ticketManagerContract = ticketManagerContract.connect(user);
            let startIndex = 0;
            let endIndex = await ticketManagerContract.getNumberOfStakesForUserAndToken(userAddress, tokenId);
            tx = await awaitTx(ticketManagerContract.claimNFTs(tokenId, startIndex, endIndex));
            expect(tx.events.length).to.equal(3);
            expect(tx.events[2].event).to.equal('NFTsClaimed');
        });

        it('should check that user withdrawn amount staked', async() => {
            let balanceAfterWithdraw = await hordToken.balanceOf(userAddress);
            expect(hordBalance.add(amountStaked)).equal(balanceAfterWithdraw);
        });

        it('should check that user received NFTs', async() => {
           let balanceNFT = await ticketFactoryContract.balanceOf(userAddress, tokenId);
           expect(balanceNFT).to.equal(ticketsBalance + ticketsToBuy);
        });
    })


});
