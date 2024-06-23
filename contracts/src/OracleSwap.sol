// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "@pythnetwork/pyth-sdk-solidity/PythUtils.sol";
import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-contracts/contracts/utils/math/SafeMath.sol";
// Example oracle AMM powered by Pyth price feeds.
//
// The contract holds a pool of two ERC-20 tokens, the BASE and the QUOTE, and allows users to swap tokens
// for the pair BASE/QUOTE. For example, the base could be WETH and the quote could be USDC, in which case you can
// buy WETH for USDC and vice versa. The pool offers to swap between the tokens at the current Pyth exchange rate for
// BASE/QUOTE, which is computed from the BASE/USD price feed and the QUOTE/USD price feed.
//
// This contract only implements the swap functionality. It does not implement any pool balancing logic (e.g., skewing the
// price to reflect an unbalanced pool) or depositing / withdrawing funds. When deployed, the contract needs to be sent
// some quantity of both the base and quote token in order to function properly (using the ERC20 transfer function to
// the contract's address).
contract OracleSwap {
    using SafeMath for uint256;

    address public owner;
    mapping(address => uint256) private baseBalances;
    mapping(address => uint256) private quoteBalances;

    event Event(string message);
    event Deposit(bool isBaseToken, address indexed user, uint256 amount);
    event Withdraw(bool isBaseToken, address indexed user, uint256 amount);
    event Swap(address trader, bool isBuy, uint256 baseAmount, uint256 quoteAmount);

    uint256 public constant LP_FEE_PERCENTAGE = 3;
    uint256 public buyFee;
    uint256 public sellFee;

    IPyth pyth;

    bytes32 baseTokenPriceId;
    bytes32 quoteTokenPriceId;

    ERC20 public baseToken;
    ERC20 public quoteToken;

    constructor(
        address _pyth,
        bytes32 _baseTokenPriceId,
        bytes32 _quoteTokenPriceId,
        address _baseToken,
        address _quoteToken
    ) {
        owner = msg.sender;
        pyth = IPyth(_pyth);
        baseTokenPriceId = _baseTokenPriceId;
        quoteTokenPriceId = _quoteTokenPriceId;
        baseToken = ERC20(_baseToken);
        quoteToken = ERC20(_quoteToken);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the contract owner can perform this action.");
        _;
    }

    // Buy or sell a quantity of the base token. `size` represents the quantity of the base token with the same number
    // of decimals as expected by its ERC-20 implementation. If `isBuy` is true, the contract will send the caller
    // `size` base tokens; if false, `size` base tokens will be transferred from the caller to the contract. Some
    // number of quote tokens will be transferred in the opposite direction; the exact number will be determined by
    // the current pyth price. The transaction will fail if either the pool or the sender does not have enough of the
    // requisite tokens for these transfers.
    //
    // `pythUpdateData` is the binary pyth price update data (retrieved from Pyth's price
    // service); this data should contain a price update for both the base and quote price feeds.
    // See the frontend code for an example of how to retrieve this data and pass it to this function.
    function swap(
        bool isBuy,
        uint256 size,
        bytes[] calldata pythUpdateData
    ) external payable {
        uint256 updateFee = pyth.getUpdateFee(pythUpdateData);
        pyth.updatePriceFeeds{value: updateFee}(pythUpdateData);
        PythStructs.Price memory currentBasePrice = pyth.getPrice(
            baseTokenPriceId
        );
        PythStructs.Price memory currentQuotePrice = pyth.getPrice(
            quoteTokenPriceId
        );
        uint256 basePrice = PythUtils.convertToUint(
            currentBasePrice.price,
            currentBasePrice.expo,
            18
        );
        uint256 quotePrice = PythUtils.convertToUint(
            currentQuotePrice.price,
            currentQuotePrice.expo,
            18
        );

        // This computation loses precision. The infinite-precision result is between [quoteSize, quoteSize + 1]
        // We need to round this result in favor of the contract.
        uint256 quoteSize = (size * basePrice) / quotePrice;

        if (isBuy) {
            uint256 feeAmount = (size * LP_FEE_PERCENTAGE / 1000) * basePrice / quotePrice;
            // (Round up)
            quoteSize += 1;

            quoteToken.transferFrom(msg.sender, address(this), (quoteSize + feeAmount));
            baseToken.transfer(msg.sender, size);
            buyFee += feeAmount;
        } else {
            uint256 feeAmount = quoteSize * LP_FEE_PERCENTAGE / 1000;
            baseToken.transferFrom(msg.sender, address(this), size);
            quoteToken.transfer(msg.sender, quoteSize - feeAmount);
            sellFee += feeAmount;
        }
        emit Swap(msg.sender, isBuy, size, quoteSize);
    }

    // Get the number of base tokens in the pool
    function baseBalance() public view returns (uint256) {
        return baseToken.balanceOf(address(this));
    }

    // Get the number of quote tokens in the pool
    function quoteBalance() public view returns (uint256) {
        return quoteToken.balanceOf(address(this));
    }

    // function to add funds to the smart contract
    function deposit(bool isBaseToken, uint256 amount) external payable returns (uint256){
        require(amount > 0, "Amount must be greater than 0");
        if (isBaseToken) {
            require(baseToken.transferFrom(msg.sender, address(this), amount), "Token transfer failed");
            baseBalances[msg.sender] += amount;
            emit Deposit(isBaseToken, msg.sender, amount);
            return baseBalances[msg.sender];
        } else {
            require(quoteToken.transferFrom(msg.sender, address(this), amount), "Token transfer failed");
            quoteBalances[msg.sender] += amount;
            emit Deposit(isBaseToken, msg.sender, amount);
            return quoteBalances[msg.sender];
        }
    }

    function withdraw(bool isBaseToken, uint256 amount) external payable returns (uint256){
        require(amount > 0, "Amount must be greater than 0");
        if (isBaseToken) {
            require(baseBalances[msg.sender] >= amount, "Insufficient balance");
            require(baseToken.transfer(msg.sender, amount), "Token transfer failed");
            baseBalances[msg.sender] -= amount;
            emit Withdraw(isBaseToken, msg.sender, amount);
            return baseBalances[msg.sender];
        } else {
            require(quoteBalances[msg.sender] >= amount, "Insufficient balance");
            require(quoteToken.transfer(msg.sender, amount), "Token transfer failed");
            quoteBalances[msg.sender] -= amount;
            emit Withdraw(isBaseToken, msg.sender, amount);
            return quoteBalances[msg.sender];
        }
    }

    function balanceOf(bool isBaseToken, address wallet) public view returns (uint256) {
        if (isBaseToken) {
            return baseBalances[wallet];
        } else {
            return quoteBalances[wallet];
        }
    }

    function withdrawIncentives() external onlyOwner {
        quoteToken.transfer(msg.sender, buyFee + sellFee);
    }

    function withdrawAll() external onlyOwner {
        baseToken.transfer(msg.sender, baseToken.balanceOf(address(this)));
        quoteToken.transfer(msg.sender, quoteToken.balanceOf(address(this)));
    }
}
