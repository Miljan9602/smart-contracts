const hre = require("hardhat");
const { getSavedContractAddresses, getSavedContractProxies, getSavedContractProxyAbis } = require('../scripts/utils')
let c = require('../deployments/deploymentConfig.json');

async function main() {
    await hre.run('compile');

    const contracts = getSavedContractAddresses()[hre.network.name];
    const proxies = getSavedContractProxies()[hre.network.name];

    const abi = getSavedContractProxyAbis()["ProxyAdmin"];
    const admin = await hre.ethers.getContractAt(abi, proxies["ProxyAdmin"]);

    const owner = await admin.owner();

    if(owner.toString().toLowerCase() === contracts['HordCongress'].toString().toLowerCase()) {
        console.log('\n');
        console.log('Network name: ', hre.network.name)
        console.log('Network ID: ', hre.network.config.chainId);
        console.log(`Ownership of the ProxyAdmin contract is held by HordCongress (${contracts['HordCongress']}) .`);
        console.log('Verification status: ✅ ');
        console.log('------------------------------------------------------------------------------------------------')
    } else {
        console.log('Congress is not an owner. Current owner is: ', owner.toString());
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
