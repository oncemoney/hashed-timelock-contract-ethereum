/*eslint linebreak-style: ["error", "windows"]*/
const Migrations = artifacts.require('./Migrations.sol')

module.exports = function (deployer) {
  deployer.deploy(Migrations)
}
