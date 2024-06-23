#!/bin/bash -e
source .env
forge create src/OracleSwap.sol:OracleSwap \
  --private-key $PRIVATE_KEY \
  --libraries "@pythnetwork/pyth-sdk-solidity/PythUtils.sol:PythUtils:0x..." \
  --rpc-url $RPC_URL \
    --constructor-args \
    $PYTH_CONTRACT_ADDRESS \
    $BASE_FEED_ID \
    $QUOTE_FEED_ID \
    $BASE_ERC20_ADDR \
    $QUOTE_ERC20_ADDR