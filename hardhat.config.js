require('@nomiclabs/hardhat-waffle')
require('@nomiclabs/hardhat-ethers')
require("@nomiclabs/hardhat-web3")
require('@openzeppelin/hardhat-upgrades')
require("@tenderly/hardhat-tenderly");
require("solidity-coverage");
require('dotenv').config();

const { generateTenderlySlug } = require('./scripts/helpers/helpers');

// *** PK STATED BELOW IS DUMMY PK EXCLUSIVELY FOR TESTING PURPOSES ***
const PK = `0x${"32c069bf3d38a060eacdc072eecd4ef63f0fc48895afbacbe185c97037789875"}`

task('accounts', 'Prints the list of accounts', async () => {
  const accounts = await ethers.getSigners()
  for (const account of accounts) {
    console.log(await account.getAddress())
  }
})

// You have to export an object to set up your config
// This object can have the following optional entries:
// defaultNetwork, networks, solc, and paths.
// Go to https://buidler.dev/config/ to learn more
module.exports = {
  defaultNetwork: 'local',
  networks: {
    ropsten: {
      // Infura public nodes
      url: 'https://ropsten.infura.io/v3/34ee2e319e7945caa976d4d1e24db07f',
      accounts: [process.env.PK || PK],
      chainId: 3,
      gasPrice: 40000000000,
      timeout: 50000
    },
    ropstenStaging: {
      // Infura public nodes
      url: 'https://ropsten.infura.io/v3/34ee2e319e7945caa976d4d1e24db07f',
      accounts: [process.env.PK || PK],
      chainId: 3,
      gasPrice: 40000000000,
      timeout: 50000
    },
    kovan: {
      // Infura public nodes
      url: 'https://kovan.infura.io/v3/8632b09b72044f2c9b9ca1f621220e72',
      accounts: [process.env.PK || PK],
      chainId: 42,
      gasPrice: 5000000000,
      timeout: 50000
    },
    mainnet: {
      // Infura public nodes
      url: 'https://mainnet.tenderly.co',
      accounts: [process.env.PK || PK],
      gasPrice: 30000000000,
      chainId: 1,
      timeout: 900000000
    },
    local: {
      url: 'http://localhost:8545',
    },
  },
  solidity: {
    version: '0.6.12',
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  tenderly: {
    username: process.env.USERNAME,
    project: generateTenderlySlug()
  },
}
