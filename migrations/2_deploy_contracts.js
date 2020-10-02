/*eslint linebreak-style: ["error", "windows"]*/
const HashedTimelockERC20 = artifacts.require('./HashedTimelockERC20.sol')
const OnceERC20 = artifacts.require('./OnceERC20.sol')

module.exports = function (deployer) {
  deployer.deploy(HashedTimelockERC20)
  deployer.deploy(OnceERC20)
}
