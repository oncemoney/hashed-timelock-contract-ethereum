/*eslint linebreak-style: ["error", "windows"]*/

import MetaMaskOnboarding from '@metamask/onboarding'


const {
  newSecretHashPair,
  nowSeconds,
  txContractId,
  txLoggedArgs,
} = require('../helper/utils')

const currentUrl = new URL(window.location.href)
const forwarderOrigin = currentUrl.hostname === 'localhost'
  ? 'http://localhost:9010'
  : undefined

const isMetaMaskInstalled = () => {
  const { ethereum } = window
  return Boolean(ethereum && ethereum.isMetaMask)
}

// Dapp Status Section
const consolelog = document.getElementById('consolelog')

const screenLogger = (msg) => {
  consolelog.innerHTML += `<p>${msg}<p>`
}

const networkDiv = document.getElementById('network')
const chainIdDiv = document.getElementById('chainId')
const accountsDiv = document.getElementById('accounts')

// Basic Actions Section
const onboardButton = document.getElementById('connectButton')


// Contract Section
const deployButton = document.getElementById('deployButton')
const depositButton = document.getElementById('depositButton')
const withdrawButton = document.getElementById('withdrawButton')


// Send Tokens Section
const approveTokens = document.getElementById('approveTokens')

// Fileds
const approveAmount = document.getElementById('approveAmount')
const depositAmount = document.getElementById('depositAmount')
const depositTimelock = document.getElementById('depositTimelock')
const withdrawContractId = document.getElementById('withdrawContractId')
const withdrawContractHashlock = document.getElementById('withdrawContractHashlock')


const initialize = async () => {

  let onboarding
  try {
    onboarding = new MetaMaskOnboarding({ forwarderOrigin })
  } catch (error) {
    console.error(error)
  }


  const onceAddress = '0xdE73cb2eC18ad77c11085532f92118a6B696CCA8'

  const hashPair = newSecretHashPair()


  let accounts
  let accountButtonsInitialized = false

  const accountButtons = [
    deployButton,
    depositButton,
    withdrawButton,
    approveTokens,
  ]

  const isMetaMaskConnected = () => accounts && accounts.length > 0

  const onClickInstall = () => {
    onboardButton.innerText = 'Onboarding in progress'
    onboardButton.disabled = true
    onboarding.startOnboarding()
  }

  const onClickConnect = async () => {
    try {
      const newAccounts = await ethereum.request({
        method: 'eth_requestAccounts',
      })
      handleNewAccounts(newAccounts)
    } catch (error) {
      console.error(error)
    }
  }


  const updateButtons = () => {
    const accountButtonsDisabled = !isMetaMaskInstalled() || !isMetaMaskConnected()
    if (accountButtonsDisabled) {
      for (const button of accountButtons) {
        button.disabled = true
      }
    } else {
      deployButton.disabled = false
    }

    if (!isMetaMaskInstalled()) {
      onboardButton.innerText = 'Click here to install MetaMask!'
      onboardButton.onclick = onClickInstall
      onboardButton.disabled = false
    } else if (isMetaMaskConnected()) {
      onboardButton.innerText = 'Wallet Connected'
      onboardButton.disabled = true
      if (onboarding) {
        onboarding.stopOnboarding()
      }
    } else {
      onboardButton.innerText = 'Connect your wallet'
      onboardButton.onclick = onClickConnect
      onboardButton.disabled = false
    }
  }

  const initializeAccountButtons = () => {

    if (accountButtonsInitialized) {
      return
    }
    accountButtonsInitialized = true

    const web3Provider = window.ethereum


    /**
     * Contract Interactions
     */
    const contract = require('@truffle/contract')
    const HashedTimelockERC20Json = require('../build/contracts/HashedTimelockERC20.json')
    const HashedTimelockERC20 = contract(HashedTimelockERC20Json)
    const OnceERC20Json = require('../build/contracts/OnceERC20.json')
    const OnceERC20 = contract(OnceERC20Json)

    HashedTimelockERC20.setProvider(web3Provider)
    OnceERC20.setProvider(web3Provider)


    deployButton.onclick = async () => {
      screenLogger('Deploying ...')

      HashedTimelockERC20.new({ from: accounts[0] }).then(function (contract) {
        return contract
      }).then(function (contract) {

        screenLogger(`Contract Deployed! addr:${contract.address} tx:${contract.transactionHash}`)
        approveTokens.disabled = false
        depositButton.disabled = false
        withdrawButton.disabled = false

        approveTokens.onclick = () => {
          OnceERC20.at(onceAddress).then(function (instance) {
            return instance.approve(contract.address, approveAmount.value, {
              from: accounts[0],
            })
          }).then(function (result) {
            screenLogger(JSON.stringify(result))
            screenLogger(`${approveAmount.value} ONCE approved !`)
          }).catch(function (err) {
            screenLogger(`ERROR! ${err.message}`)
          })


        }

        depositButton.onclick = () => {
          screenLogger('Deposit initiated')
          const timelock = nowSeconds() + Number(depositTimelock.value)
          const tokenAmount = Number(depositAmount.value)

          contract.newContract(
            hashPair.hash,
            timelock,
            onceAddress,
            tokenAmount,
            {
              from: accounts[0],
            },
          ).then(function (newContractTx) {
            const contractId = txContractId(newContractTx)
            withdrawContractId.value = contractId
            screenLogger(`Deposit Complete, {$contractId}`)
            withdrawContractHashlock.value = hashPair.secret
            // check event logs
            const logArgs = txLoggedArgs(JSON.stringify(newContractTx))
            screenLogger(logArgs)
          }).catch(function (err) {
            screenLogger(`ERROR! ${err.message}`)
          })


        }
        withdrawButton.onclick = () => {
          const contractId = withdrawContractId.value
          const hashLockSecrect = withdrawContractHashlock.value
          contract.refund.call(contractId, hashLockSecrect, { from: accounts[0] })
          contract.getContract.call(contractId).then(function (result) {
            screenLogger(JSON.stringify(result))
            screenLogger(`${approveAmount.value} ONCE Locked !`)
          }).catch(function (err) {
            screenLogger(`ERROR! ${err.message}`)
          })
        }

      }).catch(function (err) {
        screenLogger(err.message)
      })
    }


    /**
     * Encrypt / Decrypt
     */

    // getEncryptionKeyButton.onclick = async () => {
    //   try {
    //     encryptionKeyDisplay.innerText = await ethereum.request({
    //       method: 'eth_getEncryptionPublicKey',
    //       params: [accounts[0]],
    //     })
    //     encryptMessageInput.disabled = false
    //   } catch (error) {
    //     encryptionKeyDisplay.innerText = `Error: ${error.message}`
    //     encryptMessageInput.disabled = true
    //     encryptButton.disabled = true
    //     decryptButton.disabled = true
    //   }
    // }

    // encryptMessageInput.onkeyup = () => {
    //   if (
    //     !getEncryptionKeyButton.disabled &&
    //     encryptMessageInput.value.length > 0
    //   ) {
    //     if (encryptButton.disabled) {
    //       encryptButton.disabled = false
    //     }
    //   } else if (!encryptButton.disabled) {
    //     encryptButton.disabled = true
    //   }
    // }

    // encryptButton.onclick = () => {
    //   try {
    //     ciphertextDisplay.innerText = web3.toHex(JSON.stringify(
    //       encrypt(
    //         encryptionKeyDisplay.innerText,
    //         { 'data': encryptMessageInput.value },
    //         'x25519-xsalsa20-poly1305',
    //       ),
    //     ))
    //     decryptButton.disabled = false
    //   } catch (error) {
    //     ciphertextDisplay.innerText = `Error: ${error.message}`
    //     decryptButton.disabled = true
    //   }
    // }

    // decryptButton.onclick = async () => {
    //   try {
    //     cleartextDisplay.innerText = await ethereum.request({
    //       method: 'eth_decrypt',
    //       params: [ciphertextDisplay.innerText, ethereum.selectedAddress],
    //     })
    //   } catch (error) {
    //     cleartextDisplay.innerText = `Error: ${error.message}`
    //   }
    // }
  }

  function handleNewAccounts (newAccounts) {
    accounts = newAccounts
    accountsDiv.innerHTML = accounts
    if (isMetaMaskConnected()) {
      initializeAccountButtons()
    }
    updateButtons()
  }

  function handleNewChain (chainId) {
    chainIdDiv.innerHTML = chainId
  }

  function handleNewNetwork (networkId) {
    networkDiv.innerHTML = networkId
  }

  async function getNetworkAndChainId () {
    try {
      const chainId = await ethereum.request({
        method: 'eth_chainId',
      })
      handleNewChain(chainId)

      const networkId = await ethereum.request({
        method: 'net_version',
      })
      handleNewNetwork(networkId)
    } catch (err) {
      console.error(err)
    }
  }

  updateButtons()

  if (isMetaMaskInstalled()) {

    ethereum.autoRefreshOnNetworkChange = false
    getNetworkAndChainId()

    ethereum.on('chainChanged', handleNewChain)
    ethereum.on('networkChanged', handleNewNetwork)
    ethereum.on('accountsChanged', handleNewAccounts)

    try {
      const newAccounts = await ethereum.request({
        method: 'eth_accounts',
      })
      handleNewAccounts(newAccounts)
    } catch (err) {
      console.error('Error on init when getting accounts', err)
    }
  }
}

window.addEventListener('DOMContentLoaded', initialize)


