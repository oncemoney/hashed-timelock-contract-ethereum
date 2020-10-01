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
      withdrawButton.disabled = false
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

      if( htlcAddress !== '0x0000000000000000000000000000000000000000'){
        screenLogger(`Contract already deployed at ${htlcAddress}`)
        deployButton.disabled = true
        approveTokens.disabled = false
        return false
      }

      screenLogger('Deploying ...')

      HashedTimelockERC20.new({ from: accounts[0] }).then(function (instance) {

        screenLogger(`HashedTimelock Contract Deployed! addr:${instance.address} tx:${instance.transactionHash}`)
        htlcAddress = instance.address
        deployButton.disabled = true
        approveTokens.disabled = false

      }).catch(function (err) {
        screenLogger(err.message)
      })
    }

    approveTokens.onclick = () => {

      if( htlcAddress === '0x0000000000000000000000000000000000000000'){
        deployButton.disabled = true
        screenLogger('Please deploy Lockup Contract first!')
        return false
      }

      let tokenAmount = Number(approveAmount.value)
      if(tokenAmount <= 0.0001) {
        alert('Approve amount must be > 0.0001 ONCE')
        return false
      }

      let toWeiAmount = web3.toWei(tokenAmount)

      OnceERC20.at(onceAddress).then(function (instance) {
        return instance.approve(htlcAddress, toWeiAmount, {
          from: accounts[0],
        })
      }).then(function (result) {
        screenLogger(JSON.stringify(result))
        screenLogger(`${approveAmount.value} ONCE approved !`)
        depositButton.disabled = false
      }).catch(function (err) {
        screenLogger(`ERROR! ${err.message}`)
      })
    }

    depositButton.onclick = () => {

      if( htlcAddress === '0x0000000000000000000000000000000000000000'){
        deployButton.disabled = true
        screenLogger('Please deploy Lockup Contract first!')
        return false
      }

      screenLogger('Deposit initiated')
      
      let tokenAmount = Number(depositAmount.value)
      if(tokenAmount <= 0.0001) {
        alert('Approve amount must be > 0.0001 ONCE')
        return false
      }

      let toWeiAmount = web3.toWei(tokenAmount)

      let timelock = nowSeconds() + Number(depositTimelock.value)
      let t = new Date(timelock*1000).toLocaleTimeString("en-US")
      let d = new Date(timelock*1000).toLocaleDateString("en-US")

      HashedTimelockERC20.at(htlcAddress).then(function (instance) {
        return instance.newContract(
          hashPair.hash,
          timelock,
          onceAddress,
          toWeiAmount,
          {
            from: accounts[0],
          },
        )
      }).then(function (newContractTx) {
        const contractId = txContractId(newContractTx)
        withdrawContractId.value = contractId
        screenLogger(`${tokenAmount} ONCE Deposit Complete, Lockuped up until ${d} ${t}, contract ID ${contractId}`)
        withdrawContractHashlock.value = hashPair.secret
        // check event logs
        const logArgs = JSON.stringify(txLoggedArgs(newContractTx))
        screenLogger(logArgs)
      }).catch(function (err) {
        screenLogger(`ERROR! ${err.message}`)
      })
    }

    withdrawButton.onclick = () => {

      if( htlcAddress === '0x0000000000000000000000000000000000000000'){
        deployButton.disabled = true
        screenLogger('Please deploy Lockup Contract first!')
        return false
      }

      const contractId = String(withdrawContractId.value)
      const hashLockSecrect = String(withdrawContractHashlock.value)

      if (contractId.length === 0 ) {
        alert('Please insert Lockup contract ID')
        return false
      }

      if (hashLockSecrect.length === 0 ) {
        alert('Please insert hashLock Secrect')
        return false
      }

      HashedTimelockERC20.at(htlcAddress).then(function (instance) {
        return instance.refund(
          contractId, 
          hashLockSecrect, 
          { from: accounts[0] }
        )
      }).then(function (result) {
        screenLogger('Lockup refunded! check your balance')
        screenLogger(JSON.stringify(result))
      }).catch(function (err) {
        screenLogger(`ERROR! ${err.message}`)
      })
    }
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


