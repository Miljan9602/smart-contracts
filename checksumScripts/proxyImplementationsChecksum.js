const hre = require("hardhat");
const assert = require('assert');
const { getSavedContractAddresses, getSavedContractProxies, getSavedContractProxyAbis } = require('../scripts/utils')

async function main() {

    await hre.run('compile')

    const contracts = getSavedContractAddresses()[hre.network.name]
    const proxies = getSavedContractProxies()[hre.network.name]
    const abi = getSavedContractProxyAbis()["ProxyAdmin"]
    const admin = await hre.ethers.getContractAt(abi, proxies["ProxyAdmin"])
    const standard = 42
    const border = (standard+4)*4

    console.log("-".repeat(border));
    console.log(
        "|Proxy Name:"," ".repeat(standard - "Proxy Name:".length),"|",
        "Local Implementation:"," ".repeat(standard - "Local Implementation:".length),"|",
        "Proxy Implementation:"," ".repeat(standard - "Proxy Implementation:".length),"|",
        "Is Synced"," ".repeat(standard - "Is Synced".length),"|"
    )
    console.log("-".repeat(46*4));

    for(const proxy in proxies) {
        if(proxy !== "ProxyAdmin"){
            let localImplementation = contracts[proxy];
            let proxyImplementation = await admin.getProxyImplementation(proxies[proxy]);
            let isSynced = false
            if(localImplementation.toLowerCase() === proxyImplementation.toLowerCase()) isSynced = true
            console.log(
                "|"+proxy," ".repeat(standard - proxy.length),"|",
                localImplementation," ".repeat(standard - localImplementation.length),"|",
                proxyImplementation," ".repeat(standard - proxyImplementation.length),"|",
                isSynced," ".repeat(standard - isSynced.toString().length),"|"
            );
        }
    }

    console.log("-".repeat(border));
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.log(error);
        process.exit(1);
    });
