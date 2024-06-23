#!/bin/bash -e
source .env
forge create node_modules/@pythnetwork/pyth-sdk-solidity/PythUtils.sol:PythUtils \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL

