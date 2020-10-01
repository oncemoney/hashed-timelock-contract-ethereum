/*eslint linebreak-style: ["error", "windows"]*/
const HtlcWrapperErc20 = require('../../wrapper/htlc-wrapper-erc20')

const { assertEqualBN } = require('../helper/assert')
const {
  htlcERC20ArrayToObj,
  isSha256Hash,
  newSecretHashPair,
  nowSeconds,
  txLoggedArgs,
} = require('../helper/utils')

const HashedTimelockERC20 = artifacts.require('./HashedTimelockERC20.sol')
const OnceERC20 = artifacts.require('./helper/OnceERC20.sol')

// some testing data
const hourSeconds = 3600
const timeLock1Hour = nowSeconds() + hourSeconds
const tokenAmount = 5

contract('HashedTimelockErc20Wrapper', (accounts) => {
  const sender = accounts[1]
  const senderInitialBalance = 100
  const provider = new web3.providers.HttpProvider('http://localhost:7545')

  let htlcWrapper
  let token

  const assertTokenBal = async (addr, tokenAmount, msg) => assertEqualBN(
    await token.balanceOf.call(addr),
    tokenAmount,
    msg || 'wrong token balance',
  )

  before(async () => {
    htlcWrapper = new HtlcWrapperErc20(HashedTimelockERC20, provider, null)
    const address = await HashedTimelockERC20.new()
    htlcWrapper.setAddress(address.address)
    token = await OnceERC20.new()
    await token.transfer(sender, senderInitialBalance)
    await assertTokenBal(
      sender,
      senderInitialBalance,
      'balance not transferred in before()',
    )
  })

  it('newContract() in wrapper should create new contract and store correct details', async () => {
    const hashPair = newSecretHashPair()
    await token.approve(htlcWrapper.address, tokenAmount, { from: sender })
    const newContractTx = await htlcWrapper.newContract(
      hashPair.hash,
      timeLock1Hour,
      token.address,
      tokenAmount,
      sender,
    )

    // check token balances
    assertTokenBal(sender, senderInitialBalance - tokenAmount)
    assertTokenBal(htlcWrapper.address, tokenAmount)

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
    const contractArr = await htlcWrapper.getContract(contractId)
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
})
