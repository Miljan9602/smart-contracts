const { ethers, expect, isEthException, awaitTx, toHordDenomination } = require('./setup')
const config = require('../deployments/deploymentConfig.json');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const INITIAL_SUPPLY = toHordDenomination(config.hordTotalSupply)
const transferAmount = toHordDenomination(10)
const unitTokenAmount = toHordDenomination(1)

const overdraftAmount = INITIAL_SUPPLY.add(unitTokenAmount)
const overdraftAmountPlusOne = overdraftAmount.add(unitTokenAmount)
const overdraftAmountMinusOne = overdraftAmount.sub(unitTokenAmount)
const transferAmountPlusOne = transferAmount.add(unitTokenAmount)
const transferAmountMinusOne = transferAmount.sub(unitTokenAmount)

let hordToken, owner, ownerAddr, anotherAccount, anotherAccountAddr, recipient, recipientAddr, r

async function setupContractAndAccounts () {
  accounts = await ethers.getSigners()
  owner = accounts[0]
  ownerAddr = await owner.getAddress()
  anotherAccount = accounts[8]
  anotherAccountAddr = await anotherAccount.getAddress()
  recipient = accounts[9]
  recipientAddr = await recipient.getAddress()

  const Hord = await hre.ethers.getContractFactory("Hord");
  hordToken = await Hord.deploy(
      config.hordTokenName,
      config.hordTokenSymbol,
      toHordDenomination(config.hordTotalSupply.toString()),
      ownerAddr
  );
  await hordToken.deployed()
  hordToken = hordToken.connect(owner)
}

describe('HordToken:ERC20', () => {
  before('setup HordToken contract', async () => {
    await setupContractAndAccounts()
  })

  describe('totalSupply', () => {
    it('returns the total amount of tokens', async () => {
      (await hordToken.totalSupply()).should.equal(INITIAL_SUPPLY)
    })
  })

  describe('balanceOf', () => {
    describe('when the requested account has no tokens', () => {
      it('returns zero', async () => {
        (await hordToken.balanceOf(anotherAccountAddr)).should.equal(0)
      })
    })

    describe('when the requested account has some tokens', () => {
      it('returns the total amount of tokens', async () => {
        (await hordToken.balanceOf(ownerAddr)).should.equal(INITIAL_SUPPLY)
      })
    })
  })
})

describe('HordToken:ERC20:transfer', () => {
  before('setup HordToken contract', async () => {
    await setupContractAndAccounts()
  })

  describe('when the sender does NOT have enough balance', () => {
    it('reverts', async () => {
      expect(
          await isEthException(hordToken.transfer(recipientAddr, overdraftAmount))
      ).to.be.true
    })
  })

  describe('when the sender has enough balance', () => {
    before(async () => {
      r = await awaitTx(hordToken.transfer(recipientAddr, transferAmount))
    })

    it('should transfer the requested amount', async () => {
      const senderBalance = await hordToken.balanceOf(ownerAddr)
      const recipientBalance = await hordToken.balanceOf(recipientAddr)
      const supply = await hordToken.totalSupply()
      supply.sub(transferAmount).should.equal(senderBalance)
      recipientBalance.should.equal(transferAmount)
    })
    it('should emit a transfer event', async () => {
      expect(r.events.length).to.equal(1)
      expect(r.events[0].event).to.equal('Transfer')
      expect(r.events[0].args.from).to.equal(ownerAddr)
      expect(r.events[0].args.to).to.equal(recipientAddr)
      r.events[0].args.value.should.equal(transferAmount)
    })
  })

  describe('when the recipient is the zero address', () => {
    it('should fail', async () => {
      expect(
          await isEthException(hordToken.transfer(ZERO_ADDRESS, transferAmount))
      ).to.be.true
    })
  })
})

describe('HordToken:ERC20:transferFrom', () => {
  before('setup HordToken contract', async () => {
    await setupContractAndAccounts()
  })

  describe('when the spender does NOT have enough approved balance', () => {
    describe('when the owner does NOT have enough balance', () => {
      it('reverts', async () => {
        await awaitTx(hordToken.approve(anotherAccountAddr, overdraftAmountMinusOne))
        expect(
            await isEthException(hordToken.connect(anotherAccount).transferFrom(ownerAddr, recipientAddr, overdraftAmount))
        ).to.be.true
      })
    })

    describe('when the owner has enough balance', () => {
      it('reverts', async () => {
        await awaitTx(hordToken.approve(anotherAccountAddr, transferAmountMinusOne))
        expect(
            await isEthException(hordToken.connect(anotherAccount).transferFrom(ownerAddr, recipientAddr, transferAmount))
        ).to.be.true
      })
    })
  })

  describe('when the spender has enough approved balance', () => {
    describe('when the owner does NOT have enough balance', () => {
      it('should fail', async () => {
        await awaitTx(hordToken.approve(anotherAccountAddr, overdraftAmount))
        expect(
            await isEthException(hordToken.connect(anotherAccount).transferFrom(ownerAddr, recipientAddr, overdraftAmount))
        ).to.be.true
      })
    })

    describe('when the owner has enough balance', () => {
      let prevSenderBalance, r

      before(async () => {
        prevSenderBalance = await hordToken.balanceOf(ownerAddr)
        await hordToken.approve(anotherAccountAddr, transferAmount)
        r = await (await hordToken.connect(anotherAccount).transferFrom(ownerAddr, recipientAddr, transferAmount)).wait()
      });


      it('emits a transfer event', async () => {
        expect(r.events.length).to.be.equal(2);
        expect(r.events[0].event).to.equal('Transfer')
        expect(r.events[0].args.from).to.equal(ownerAddr)
        expect(r.events[0].args.to).to.equal(recipientAddr)
        r.events[0].args.value.should.equal(transferAmount)
      });

      it('transfers the requested amount', async () => {
        const senderBalance = await hordToken.balanceOf(ownerAddr)
        const recipientBalance = await hordToken.balanceOf(recipientAddr)
        prevSenderBalance.sub(transferAmount).should.equal(senderBalance)
        recipientBalance.should.equal(transferAmount)
      })

      it('decreases the spender allowance', async () => {
        expect((await hordToken.allowance(ownerAddr, anotherAccountAddr)).eq(0)).to.be.true
      })

    })
  })
})

describe('HordToken:ERC20:approve', () => {
  before('setup HordToken contract', async () => {
    await setupContractAndAccounts()
  })

  describe('when the spender is NOT the zero address', () => {
    describe('when the sender has enough balance', () => {
      describe('when there was no approved amount before', () => {
        before(async () => {
          await awaitTx(hordToken.approve(anotherAccountAddr, 0))
          r = await awaitTx(hordToken.approve(anotherAccountAddr, transferAmount))
        })

        it('approves the requested amount', async () => {
          (await hordToken.allowance(ownerAddr, anotherAccountAddr)).should.equal(transferAmount)
        })

        it('emits an approval event', async () => {
          expect(r.events.length).to.equal(1)
          expect(r.events[0].event).to.equal('Approval')
          expect(r.events[0].args.owner).to.equal(ownerAddr)
          expect(r.events[0].args.spender).to.equal(anotherAccountAddr)
          r.events[0].args.value.should.equal(transferAmount)
        })
      })

      describe('when the spender had an approved amount', () => {
        before(async () => {
          await awaitTx(hordToken.approve(anotherAccountAddr, toHordDenomination(1)))
          r = await awaitTx(hordToken.approve(anotherAccountAddr, transferAmount))
        })

        it('approves the requested amount and replaces the previous one', async () => {
          (await hordToken.allowance(ownerAddr, anotherAccountAddr)).should.equal(transferAmount)
        })

        it('emits an approval event', async () => {
          expect(r.events.length).to.equal(1)
          expect(r.events[0].event).to.equal('Approval')
          expect(r.events[0].args.owner).to.equal(ownerAddr)
          expect(r.events[0].args.spender).to.equal(anotherAccountAddr)
          r.events[0].args.value.should.equal(transferAmount)
        })
      })
    })

    describe('when the sender does not have enough balance', () => {
      describe('when there was no approved amount before', () => {
        before(async () => {
          await hordToken.approve(anotherAccountAddr, 0)
          r = await (await hordToken.approve(anotherAccountAddr, overdraftAmount)).wait()
        })

        it('approves the requested amount', async () => {
          (await hordToken.allowance(ownerAddr, anotherAccountAddr)).should.equal(overdraftAmount)
        })

        it('emits an approval event', async () => {
          expect(r.events.length).to.equal(1)
          expect(r.events[0].event).to.equal('Approval')
          expect(r.events[0].args.owner).to.equal(ownerAddr)
          expect(r.events[0].args.spender).to.equal(anotherAccountAddr)
          r.events[0].args.value.should.equal(overdraftAmount)
        })
      })

      describe('when the spender had an approved amount', () => {
        before(async () => {
          await hordToken.approve(anotherAccountAddr, toHordDenomination(1))
          r = await (await hordToken.approve(anotherAccountAddr, overdraftAmount)).wait()
        })

        it('approves the requested amount', async () => {
          (await hordToken.allowance(ownerAddr, anotherAccountAddr)).should.equal(overdraftAmount)
        })

        it('emits an approval event', async () => {
          expect(r.events.length).to.equal(1)
          expect(r.events[0].event).to.equal('Approval')
          expect(r.events[0].args.owner).to.equal(ownerAddr)
          expect(r.events[0].args.spender).to.equal(anotherAccountAddr)
          r.events[0].args.value.should.equal(overdraftAmount)
        })
      })
    })
  })
})

describe('HordToken:ERC20:increaseAllowance', () => {
  before('setup HordToken contract', async () => {
    await setupContractAndAccounts()
  })

  describe('when the spender is NOT the zero address', () => {
    describe('when the sender has enough balance', () => {
      describe('when there was no approved amount before', () => {
        before(async () => {
          await hordToken.approve(anotherAccountAddr, 0)
          r = await (await hordToken.increaseAllowance(anotherAccountAddr, transferAmount)).wait()
        })
        it('approves the requested amount', async () => {
          (await hordToken.allowance(ownerAddr, anotherAccountAddr)).should.equal(transferAmount)
        })

        it('emits an approval event', async () => {
          expect(r.events.length).to.equal(1)
          expect(r.events[0].event).to.equal('Approval')
          expect(r.events[0].args.owner).to.equal(ownerAddr)
          expect(r.events[0].args.spender).to.equal(anotherAccountAddr)
          r.events[0].args.value.should.equal(transferAmount)
        })
      })

      describe('when the spender had an approved amount', () => {
        beforeEach(async () => {
          await hordToken.approve(anotherAccountAddr, unitTokenAmount)
          r = await (await hordToken.increaseAllowance(anotherAccountAddr, transferAmount)).wait()
        })

        it('increases the spender allowance adding the requested amount', async () => {
          (await hordToken.allowance(ownerAddr, anotherAccountAddr)).should.equal(transferAmountPlusOne)
        })

        it('emits an approval event', async () => {
          expect(r.events.length).to.equal(1)
          expect(r.events[0].event).to.equal('Approval')
          expect(r.events[0].args.owner).to.equal(ownerAddr)
          expect(r.events[0].args.spender).to.equal(anotherAccountAddr)
          r.events[0].args.value.should.equal(transferAmountPlusOne)
        })
      })
    })

    describe('when the sender does not have enough balance', () => {
      describe('when there was no approved amount before', () => {
        before(async () => {
          await hordToken.approve(anotherAccountAddr, 0)
          r = await (await hordToken.increaseAllowance(anotherAccountAddr, overdraftAmount)).wait()
        })

        it('approves the requested amount', async () => {
          (await hordToken.allowance(ownerAddr, anotherAccountAddr)).should.equal(overdraftAmount)
        })

        it('emits an approval event', async () => {
          expect(r.events.length).to.equal(1)
          expect(r.events[0].event).to.equal('Approval')
          expect(r.events[0].args.owner).to.equal(ownerAddr)
          expect(r.events[0].args.spender).to.equal(anotherAccountAddr)
          r.events[0].args.value.should.equal(overdraftAmount)
        })
      })

      describe('when the spender had an approved amount', () => {
        beforeEach(async () => {
          await hordToken.approve(anotherAccountAddr, unitTokenAmount)
          r = await (await hordToken.increaseAllowance(anotherAccountAddr, overdraftAmount)).wait()
        })

        it('increases the spender allowance adding the requested amount', async () => {
          (await hordToken.allowance(ownerAddr, anotherAccountAddr)).should.equal(overdraftAmountPlusOne)
        })

        it('emits an approval event', async () => {
          expect(r.events.length).to.equal(1)
          expect(r.events[0].event).to.equal('Approval')
          expect(r.events[0].args.owner).to.equal(ownerAddr)
          expect(r.events[0].args.spender).to.equal(anotherAccountAddr)
          r.events[0].args.value.should.equal(overdraftAmountPlusOne)
        })
      })
    })
  })
});
