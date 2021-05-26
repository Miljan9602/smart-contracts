const hre = require("hardhat");
const { toHordDenomination } = require('../test/setup');
const { getSavedContractAddresses, saveContractAddress, saveContractProxies, getSavedContractProxies } = require('./utils');
let c = require('../deployments/deploymentConfig.json');


async function main() {
    await hre.run('compile');
    const config = c[hre.network.name];
    const contracts = getSavedContractAddresses()[hre.network.name];

    const MaintainersRegistry = await ethers.getContractFactory('MaintainersRegistry')
    const maintainersRegistry = await upgrades.deployProxy(MaintainersRegistry, [config.maintainers, contracts["HordCongress"]]);
    await maintainersRegistry.deployed()
    console.log('MaintainersRegistry Proxy deployed to:', maintainersRegistry.address);
    saveContractProxies(hre.network.name, 'MaintainersRegistry', maintainersRegistry.address);


    const HordTicketManager = await ethers.getContractFactory('HordTicketManager')
    const hordTicketManager = await upgrades.deployProxy(HordTicketManager, [
            contracts["HordCongress"],
            maintainersRegistry.address,
            contracts["HordToken"],
            config['minTimeToStake'],
            toHordDenomination(config['minAmountToStake'])
        ]
    );
    await hordTicketManager.deployed()
    console.log('HordTicketManager Proxy deployed to:', hordTicketManager.address);
    saveContractProxies(hre.network.name, 'HordTicketManager', hordTicketManager.address);


    const HordTicketFactory = await ethers.getContractFactory('HordTicketFactory')
    const hordTicketFactory = await upgrades.deployProxy(HordTicketFactory, [
            contracts["HordCongress"],
            maintainersRegistry.address,
            hordTicketManager.address,
            config["maxFungibleTicketsPerPool"],
            config["uri"],
            config["contractMetadataUri"]
        ]
    );
    await hordTicketFactory.deployed()
    console.log('HordTicketFactory Proxy deployed to:', hordTicketFactory.address);
    saveContractProxies(hre.network.name, 'HordTicketFactory', hordTicketFactory.address);


    await hordTicketManager.setHordTicketFactory(hordTicketFactory.address);
    console.log('hordTicketManager.setHordTicketFactory(', hordTicketFactory.address, ') successfully set.');

    let admin = await upgrades.admin.getInstance();

    let maintainersImplementation = await admin.getProxyImplementation(maintainersRegistry.address);
    console.log('Maintainers Implementation: ', maintainersImplementation);
    saveContractAddress(hre.network.name, 'MaintainersRegistry', maintainersImplementation);

    let ticketManagerImplementation = await admin.getProxyImplementation(hordTicketManager.address)
    console.log('HordTicketManager Implementation: ', ticketManagerImplementation);
    saveContractAddress(hre.network.name, 'HordTicketManager', ticketManagerImplementation)

    let ticketFactoryImplementation = await admin.getProxyImplementation(hordTicketFactory.address);
    console.log('HordTicketFactory Implementation: ', ticketFactoryImplementation);
    saveContractAddress(hre.network.name, 'HordTicketFactory', ticketFactoryImplementation);

    saveContractProxies(hre.network.name, 'ProxyAdmin', admin.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
