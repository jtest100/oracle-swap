import Web3 from "web3";
import {BigNumber} from "ethers";
import OracleSwapAbi from "./OracleSwapAbi.json";
import {numberToTokenQty} from "../util/utils";

export async function getBalanceInContract(
    isBaseToken: boolean,
    web3: Web3,
    contractAddress: string,
    address: string,
): Promise<BigNumber> {
    const contract = new web3.eth.Contract(OracleSwapAbi as any, contractAddress);
    const result = await contract.methods.balanceOf(isBaseToken, address).call();
    return BigNumber.from(result);
}

export async function transferToken(
    web3: Web3,
    contractAddress: string,
    isBaseToken: boolean,
    isDeposit: boolean,
    sender: String,
    qty: number,
    decimals: number,
): Promise<BigNumber> {
    const erc20 = new web3.eth.Contract(OracleSwapAbi as any, contractAddress);
    const bigNumber = numberToTokenQty(qty, decimals);
    if (isDeposit) {
        return await erc20.methods.deposit(isBaseToken, bigNumber).send({from: sender});
    } else {
        return await erc20.methods.withdraw(isBaseToken, bigNumber).send({from: sender});
    }
}

export async function swap(
    web3: Web3,
    contractAddress: string,
    isBuy: boolean,
    qtyWei: BigNumber,
    updateFee: number,
    priceFeedUpdateData: string[],
    sender: string,
): Promise<void> {
    const contract = new web3.eth.Contract(
        OracleSwapAbi as any,
        contractAddress
    );

    await contract.methods
        .swap(isBuy, qtyWei, priceFeedUpdateData)
        .send({value: updateFee, from: sender});
}

export async function getTotalIncentive(
    web3: Web3,
    contractAddress: string,
    isBaseToken: boolean,
): Promise<BigNumber> {
    const contract = new web3.eth.Contract(OracleSwapAbi as any, contractAddress);
    if (isBaseToken){
        const result = await contract.methods.buyFee().call();
        return BigNumber.from(result);
    } else {
        const result = await contract.methods.sellFee().call();
        return BigNumber.from(result);
    }
}
