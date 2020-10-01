/*eslint linebreak-style: ["error", "windows"]*/
const contract = require('@truffle/contract')

/**
 * This wrapper can be used for already deployed contracts sharing the main interfaces of HTLCs.
 */
class HtlcErc20Wrapper {

  /**
   * For additional information concerning the constructor parameters,
   * @see https://www.npmjs.com/package/@truffle/contract
   * Necessary parameters for the constructor are @param contractJson, @param provider, and @param shouldDeploy.
   *
   */
  constructor (contractJson, provider, optionalAddress) {
    this.hashedTimelockContract = contract(contractJson)
    if (provider !== null) {
      this.hashedTimelockContract.setProvider(provider)
    }
    this.address = optionalAddress
  }

  /**
   * Returns the contract ID.
   * @param hashlock bytes 32
   * @param timelock uint
   * @param tokenContract address
   * @param amount uint
   * @param sender address
   */
  newContract (hashlock, timelock, tokenContract, amount, sender) {
    return this.getContractInstance().then((instance) => {
      return instance.newContract(hashlock, timelock, tokenContract, amount, {
        from: sender,
      })
    })
  }

  /**
   * @param contractId bytes32
   * @param preimage bytes32
   * @param sender address
   */
  refund (contractId, preimage, sender) {
    return this.getContractInstance().then((instance) => {
      return instance.refund(contractId, preimage, { from: sender })
    })
  }

  /**
   * @param contractId bytes 32
   */
  getContract (contractId) {
    return this.getContractInstance().then((instance) => {
      // truffle should know using a call here
      return instance.getContract(contractId)
    })
  }

  getContractInstance () {
    if (this.address !== undefined && this.address !== null) {
      return this.hashedTimelockContract.at(this.address)
    }
    return this.hashedTimelockContract.deployed()
  }

  setAddress (address) {
    this.address = address
  }

  static deployContract (contractJson, argArray, txParams) {
    return contractJson.new(argArray, txParams)
  }

}

module.exports = HtlcErc20Wrapper
