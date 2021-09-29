const hre = require('hardhat');
const fetch = require('axios');
const { getSavedContractAddresses, getSavedContractProxies } = require('../scripts/utils');
require('dotenv').config();
const { generateTenderlySlug, checksumNetworkAndBranch, toCamel } = require('../scripts/helpers/helpers')

const tenderlyPush = async (contracts, slug) => {
    const axios = require('axios')
    await axios.post(`https://api.tenderly.co/api/v1/account/2key/project/${generateTenderlySlug()}/addresses`, {
        "contracts" : contracts
    }, {
        headers: {
            'Content-Type': 'application/json',
            'x-access-key' : process.env.ACCESS_KEY
        }
    })
        .then(res => {
            console.log(`statusCode: ${res.status} ✅`);
        })
        .catch(error => {
            console.error(error)
        });
}


async function main() {
    checksumNetworkAndBranch(hre.network.name);
    const contracts = getSavedContractAddresses()[hre.network.name]
    const proxies = getSavedContractProxies()[hre.network.name];

    const contractsToPush = [];
    const payload = [];

    // Implementations
    Object.keys(contracts).forEach(name => {
        contractsToPush.push({
            name: toCamel(name),
            address: contracts[name]
        })
        payload.push({
            "network_id": hre.network.config.chainId.toString(),
            "address": contracts[name],
            "display_name": name
        })
    });

    await hre.tenderly.push(...contractsToPush)

    Object.keys(proxies).forEach(name => {
        payload.push({
            "network_id": hre.network.config.chainId.toString(),
            "address": proxies[name],
            "display_name": name+'Proxy'
        });
    });

    await tenderlyPush(payload);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1)
    });
