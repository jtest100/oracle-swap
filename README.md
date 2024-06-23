# Oracle Swap Assignment
The demo is based on Testnet Sepolia Optimism. 2 Erc20 Tokens are deployed in the same network for demo purpose (METH and MUSDT).
METH and MUSDT could be treated as ETH and USDT respectively. Therefore, price feed of ETH/USD and USDT/USD are selected in Pyth Network.

## Deposit/Withdraw Token to the AMM
Users can deposit/withdraw by clicking the **Deposit 5000**/ **Withdraw 5000** buttons.

For simplicity, 5000 is set.

The balance in the contract is shown above the buttons.

## Incentive
Each swap transaction will be 0.3% fee in MUSDT. It can be configured before the contract deployment.

For demo purpose, it is not configured after deployment.

All fees are recorded in buyFee and sellFee.

buyFee stored all the transaction fees allocated by Buying METH.
sellFee stored all the transaction fees allocated by Selling METH.

```
uint256 public constant LP_FEE_PERCENTAGE = 3;
```

## Further development
* Make transaction fee configurable
* Reset buyFee and sellFee after incentive distribution to liquidity providers
* Incentive mechanism, e.g. Only reward liquidity providers who staked tokens with more than 30 days


## Start/Develop the defi app
Assume the metamask is setup in Sepolia Optimism with some ETH
Replace swapContractAddress in App.tsx to the contract you have deployed
For simplicity, 0xB6dF9f27De9275b5B9640DFC4BEb3855bf8539dC in Sepolia Optimism could bs used.
https://sepolia-optimism.etherscan.io/address/0xB6dF9f27De9275b5B9640DFC4BEb3855bf8539dC

```
cd app
npm install
npm run start
```

## Start/Develop the Smart Contract
### Installation
```
forge install foundry-rs/forge-std --no-git --no-commit
forge install OpenZeppelin/openzeppelin-contracts@v4.8.1 --no-git --no-commit
npm install
```

### Compiling the contract 
To check if all the libraries are installed correctly
```
forge build
```

### Deployment
* update script/.env file
* replace the env PRIVATE_KEY to yours
* Default Network is Sepolia Optimism
  * RPC_URL can be replaced to another network
  
```
cd contracts

sh script/deploy_library.sh
```
Replace the address[0x...] in deploy_contract.sh
```
sh script/deploy_contract.sh
```
### Run tests
the tests include
* test buy transaction and fee calculation
* test sell transaction and fee calculation
* test withdraw all tokens to the contract owner
```
cd contracts
forge test
```
