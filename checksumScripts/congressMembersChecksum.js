const hre = require("hardhat")
const assert = require('assert');
const { getSavedContractAddresses } = require('../scripts/utils')
let conf = require('../deployments/deploymentConfig.json')

async function main() {

    await hre.run('compile')

    const contracts = getSavedContractAddresses()[hre.network.name]
    const config = conf[hre.network.name]

    const congressName = "HordCongress"
    const congressRegistryName = "HordCongressMembersRegistry"

    // Get congress registry from json
    const congressMembersRegistryAddress = contracts[congressRegistryName]
    const congressMembersRegistryInstance = await hre.ethers.getContractAt(congressRegistryName, congressMembersRegistryAddress)

    const congressAddress = contracts[congressName]
    const congressInstance = await hre.ethers.getContractAt(congressName, congressAddress)
    const connectedMembersRegistryAddress = await congressInstance.getMembersRegistry()

    // Check that congress members registry addresses are equal
    assert.strictEqual(
        congressMembersRegistryAddress,
        connectedMembersRegistryAddress,
        'Registry addresses do not match'
    );

    // Get congress members from both config and deployment
    const connectedMembers = await congressMembersRegistryInstance.getAllMemberAddresses()
    const members = config.initialCongressMembers

    console.log("\nMembers from contract: ")
    console.log(connectedMembers + '\n')
    console.log("Members from json: ")
    console.log(members + '\n')

    assert.strictEqual(connectedMembers.length, members.length, 'Members do not match')

    // Compare members
    let counter = 0;
    for(let i = 0; i < connectedMembers.length; i++){
        for(let j = 0; j < members. length; j++){
            if(connectedMembers[i] === members[j]){
                counter++
                console.log("Found", connectedMembers[i], "+")
                break
            }
        }
    }

    assert.strictEqual(connectedMembers.length, counter, 'Members do not match')
    console.log("\nChecksum complete - All members are in the registry!")

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.log(error);
        process.exit(1);
    });
