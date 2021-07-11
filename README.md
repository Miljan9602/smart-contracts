## Hord.app Smart Contracts

<img src="./favicon.png" width="100" style="float: left;">

_HORD enables crypto champions to tokenize and monetize their influence, and empowers crypto lovers to evolve from following news and tips to capitalizing on information flow._

- Website: [https://hord.app][Official website]
- Community: [https://t.me/hord_app][Official telegram community]

### Ethereum Mainnet Addresses:

- `HordToken` : [https://etherscan.io/token/0x43A96962254855F16b925556f9e97BE436A43448][Token]
- `HordTicketFactory (NFT)` : [https://etherscan.io/address/0x32aa07e6ebf2340eef1f717197ade6982b815536][NFT Tickets]

### Developer instructions

#### Instal dependencies
`yarn install`

#### Create .env file and make sure it's having following information:
```
PK=YOUR_PRIVATE_KEY 
USERNAME=2key
```

#### Compile code
- `npx hardhat clean` (Clears the cache and deletes all artifacts)
- `npx hardhat compile` (Compiles the entire project, building all artifacts)

#### Deploy code 
- `npx hardhat node` (Starts a JSON-RPC server on top of Hardhat Network)
- `npx hardhat run --network {network} scripts/{desired_deployment_script}`

#### Flatten contracts
- `npx hardhat flatten` (Flattens and prints contracts and their dependencies)

#### Deployed addresses and bytecodes
All deployed addresses and bytecodes can be found inside `deployments/contract-addresses.json` file.


[Official website]: https://hord.app

[Official telegram community]: https://t.me/hord_app
