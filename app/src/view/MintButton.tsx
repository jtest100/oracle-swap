import Web3 from "web3";
import { numberToTokenQty } from "../util/utils";
import { mint } from "../abi/erc20";

export function MintButton(props: {
  web3: Web3;
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
              await mint(
                  props.web3,
                  props.sender,
                  props.erc20Address,
                  props.destination,
                  numberToTokenQty(props.qty, props.decimals)
              );
          } catch (ex) {
              console.error(ex);
          }
      }}
    >
      Mint {props.qty}
    </button>
  );
}
