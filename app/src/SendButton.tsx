import Web3 from "web3";
import {transferToken} from "./abi/oracle-swap-contract";

export function SendButton(props: {
    web3: Web3;
    isBaseToken: boolean;
    isDeposit: boolean;
    sender: string;
    erc20Address: string;
    destination: string;
    qty: number;
    decimals: number;
}) {
    return (
        <button
            onClick={async () => {
                try {
                    await transferToken(
                        props.web3,
                        props.destination,
                        props.isBaseToken,
                        props.isDeposit,
                        props.sender,
                        props.qty,
                        props.decimals,
                    )
                } catch (ex) {
                    console.error(ex);
                }
            }}
        >
            {props.isDeposit ? "Deposit" : "Withdraw"} {props.qty}
        </button>
    );
}
