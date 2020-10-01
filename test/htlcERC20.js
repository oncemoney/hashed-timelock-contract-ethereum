/*eslint linebreak-style: ["error", "windows"]*/
const { assertEqualBN } = require('./helper/assert')
const {
  bufToStr,
  htlcERC20ArrayToObj,
  isSha256Hash,
  newSecretHashPair,
  nowSeconds,
  random32,
  txContractId,
  txLoggedArgs,
} = require('./helper/utils')

const HashedTimelockERC20 = artifacts.require('./HashedTimelockERC20.sol')
const OnceERC20 = artifacts.require('./OnceERC20.sol')

const REQUIRE_FAILED_MSG = 'Returned error: VM Exception while processing transaction: revert'

// some testing data
const hourSeconds = 3600
const timeLock1Hour = nowSeconds() + hourSeconds
const tokenAmount = 5

contract('HashedTimelockERC20', (accounts) => {
  const sender = accounts[1]
  const senderInitialBalance = 100

  let htlc
  let token

  const assertTokenBal = async (addr, tokenAmount, msg) => assertEqualBN(
    await token.balanceOf.call(addr),
    tokenAmount,
    msg || 'wrong token balance',
  )

  before(async () => {
    htlc = await HashedTimelockERC20.new()
    token = await OnceERC20.new()
    await token.transfer(sender, senderInitialBalance)
    await assertTokenBal(
      sender,
      senderInitialBalance,
      'balance not transferred in before()',
    )
  })

  it('newContract() should create new contract and store correct details', async () => {
    const hashPair = newSecretHashPair()
    const newContractTx = await newContract({
      hashlock: hashPair.hash,
    })

    // check token balances
    assertTokenBal(sender, senderInitialBalance - tokenAmount)
    assertTokenBal(htlc.address, tokenAmount)

    // check event logs
    const logArgs = txLoggedArgs(newContractTx)

    const { contractId } = logArgs
    assert(isSha256Hash(contractId))

    assert.equal(logArgs.sender, sender)
    assert.equal(logArgs.tokenContract, token.address)
    assert.equal(logArgs.amount.toNumber(), tokenAmount)
    assert.equal(logArgs.hashlock, hashPair.hash)
    assert.equal(logArgs.timelock, timeLock1Hour)

    // check htlc record
    const contractArr = await htlc.getContract.call(contractId)
    const contract = htlcERC20ArrayToObj(contractArr)
    assert.equal(contract.sender, sender)
    assert.equal(contract.token, token.address)
    assert.equal(contract.amount.toNumber(), tokenAmount)
    assert.equal(contract.hashlock, hashPair.hash)
    assert.equal(contract.timelock.toNumber(), timeLock1Hour)
    assert.isFalse(contract.refunded)
    assert.equal(
      contract.preimage,
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    )
  })

  it('newContract() should fail when no token transfer approved', async () => {
    await token.approve(htlc.address, 0, { from: sender }) // ensure 0
    await newContractExpectFailure('expected failure due to no tokens approved')
  })

  it('newContract() should fail when token amount is 0', async () => {
    // approve htlc for one token but send amount as 0
    await token.approve(htlc.address, 1, { from: sender })
    await newContractExpectFailure('expected failure due to 0 token amount', {
      amount: 0,
    })
  })

  it('newContract() should fail when tokens approved for some random account', async () => {
    // approve htlc for different account to the htlc contract
    await token.approve(htlc.address, 0, { from: sender }) // ensure 0
    await token.approve(accounts[9], tokenAmount, { from: sender })
    await newContractExpectFailure('expected failure due to wrong approval')
  })

  it('newContract() should fail when the timelock is in the past', async () => {
    const pastTimelock = nowSeconds() - 2
    await token.approve(htlc.address, tokenAmount, { from: sender })
    await newContractExpectFailure(
      'expected failure due to timelock in the past',
      { timelock: pastTimelock },
    )
  })

  it('newContract() should reject a duplicate contract request', async () => {
    const hashlock = newSecretHashPair().hash
    const timelock = timeLock1Hour + 5
    const balBefore = web3.utils.toBN(await token.balanceOf(htlc.address))

    await newContract({ hashlock, timelock })
    await assertTokenBal(
      htlc.address,
      balBefore.add(web3.utils.toBN(tokenAmount)),
      'tokens not transfered to htlc contract',
    )

    await token.approve(htlc.address, tokenAmount, { from: sender })
    // now attempt to create another with the exact same parameters
    await newContractExpectFailure(
      'expected failure due to duplicate contract details',
      {
        timelock,
        hashlock,
      },
    )
  })

  it('refund() should unlock funds when given the correct secret preimage', async () => {
    const hashPair = newSecretHashPair()
    const curBlock = await web3.eth.getBlock('latest')
    const timelock2s = curBlock.timestamp + 2

    const newContractTx = await newContract({
      timelock: timelock2s,
      hashlock: hashPair.hash,
    })
    const contractId = txContractId(newContractTx)

    // wait 2 seconds so we move past the timelock time
    return new Promise((resolve, reject) => setTimeout(async () => {
      try {
        // attempt to get the refund now we've moved past the timelock time
        const balBefore = await token.balanceOf(sender)
        await htlc.refund(contractId, hashPair.secret, { from: sender })

        // Check tokens returned to the sender
        await assertTokenBal(
          sender,
          balBefore.add(web3.utils.toBN(tokenAmount)),
          `sender balance unexpected`,
        )

        const contractArr = await htlc.getContract.call(contractId)
        const contract = htlcERC20ArrayToObj(contractArr)
        assert.isTrue(contract.refunded)
        assert.equal(contract.preimage, hashPair.secret)
        resolve()
      } catch (err) {
        reject(err)
      }
    }, 5000))
  })

  it('refund() should fail if preimage does not hash to hashX', async () => {
    const newContractTx = await newContract({})
    const contractId = txContractId(newContractTx)

    // sender calls refund with an invalid secret
    const wrongSecret = bufToStr(random32())
    try {
      await htlc.refund(contractId, wrongSecret, { from: sender })
      assert.fail('expected failure due to 0 value transferred')
    } catch (err) {
      assert.isTrue(err.message.startsWith(REQUIRE_FAILED_MSG))
    }
  })

  it('refund() should fail if caller is not the sender ', async () => {
    const hashPair = newSecretHashPair()
    await token.approve(htlc.address, tokenAmount, { from: sender })
    const newContractTx = await newContract({
      hashlock: hashPair.hash,
    })
    const contractId = txContractId(newContractTx)
    const someGuy = accounts[4]
    try {
      await htlc.refund(contractId, hashPair.secret, { from: someGuy })
      assert.fail('expected failure due to wrong sender')
    } catch (err) {
      assert.isTrue(err.message.startsWith(REQUIRE_FAILED_MSG))
    }
  })

  it('refund() should pass after timelock expiry', async () => {
    const hashPair = newSecretHashPair()
    const curBlock = await web3.eth.getBlock('latest')
    const timelock2Seconds = curBlock.timestamp + 2

    const newContractTx = await newContract({
      timelock: timelock2Seconds,
      hashlock: hashPair.hash,
    })
    const contractId = txContractId(newContractTx)

    // wait 2 seconds so we move past the timelock time
    return new Promise((resolve, reject) => setTimeout(async () => {
      try {
        // attempt to get the refund now we've moved past the timelock time
        const balBefore = await token.balanceOf(sender)
        await htlc.refund(contractId, hashPair.secret, { from: sender })

        // Check tokens returned to the sender
        await assertTokenBal(
          sender,
          balBefore.add(web3.utils.toBN(tokenAmount)),
          `sender balance unexpected`,
        )

        const contractArr = await htlc.getContract.call(contractId)
        const contract = htlcERC20ArrayToObj(contractArr)
        assert.isTrue(contract.refunded)
        resolve()
      } catch (err) {
        reject(err)
      }
    }, 2000))
  })

  it('refund() should fail before the timelock expiry', async () => {
    const hashPair = newSecretHashPair()
    const newContractTx = await newContract({ hashlock: hashPair.hash })
    const contractId = txContractId(newContractTx)
    try {
      await htlc.refund(contractId, hashPair.secret, { from: sender })
      assert.fail('expected failure due to timelock')
    } catch (err) {
      assert.isTrue(err.message.startsWith(REQUIRE_FAILED_MSG))
    }
  })

  it("getContract() returns empty record when contract doesn't exist", async () => {
    const htlc = await HashedTimelockERC20.deployed()
    const contract = await htlc.getContract.call('0xabcdef')
    const sender = contract[0]
    assert.equal(Number(sender), 0)
  })

  /*
   * Helper for newContract() calls, does the ERC20 approve before calling
   */
  const newContract = async ({
    timelock = timeLock1Hour,
    hashlock = newSecretHashPair().hash,
  } = {}) => {
    await token.approve(htlc.address, tokenAmount, { from: sender })
    return htlc.newContract(
      hashlock,
      timelock,
      token.address,
      tokenAmount,
      {
        from: sender,
      },
    )
  }

  /*
   * Helper for newContract() when expecting failure
   */
  const newContractExpectFailure = async (
    shouldFailMsg,
    {
      amount = tokenAmount,
      timelock = timeLock1Hour,
      hashlock = newSecretHashPair().hash,
    } = {},
  ) => {
    try {
      await htlc.newContract(
        hashlock,
        timelock,
        token.address,
        amount,
        {
          from: sender,
        },
      )
      assert.fail(shouldFailMsg)
    } catch (err) {
      assert.isTrue(err.message.startsWith(REQUIRE_FAILED_MSG))
    }
  }
})
