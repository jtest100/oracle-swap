import React, {useEffect, useState} from "react";
import "./App.css";
import {EvmPriceServiceConnection, HexString, Price, PriceFeed,} from "@pythnetwork/pyth-evm-js";
import {useMetaMask} from "metamask-react";
import Web3 from "web3";
import {ChainState, ExchangeRateMeta, tokenQtyToNumber} from "./util/utils";
import {OrderEntry} from "./view/OrderEntry";
import {PriceText} from "./view/PriceText";
import {MintButton} from "./view/MintButton";
import {SendButton} from "./SendButton";
import {getBalanceInContract, getTotalIncentive} from "./abi/oracle-swap-contract";
import {getBalance} from "./abi/erc20";

const CONFIG = {
    baseToken: {
        name: "METH",
        erc20Address: "0xE4C73672477a6e1dA94b7d84E910254eb9821910",
        pythPriceFeedId:
            "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
        decimals: 18,
    },
    quoteToken: {
        name: "MUSDT",
        erc20Address: "0x24d1bbb1D87AaCCcEF4D2F165E302653Ed33b65C",
        pythPriceFeedId:
            "2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
        decimals: 18,
    },
    swapContractAddress: "0xB6dF9f27De9275b5B9640DFC4BEb3855bf8539dC",
    pythContractAddress: "0x0708325268dF9F66270F1401206434524814508b",
    hermesUrl: "https://hermes.pyth.network",
    mintQty: 10000,
    sendQty: 5000,
    withdrawQty: 5000,
};

function App() {
    const {status, connect, account, ethereum} = useMetaMask();

    const [web3, setWeb3] = useState<Web3 | undefined>(undefined);

    useEffect(() => {
        if (status === "connected") {
            setWeb3(new Web3(ethereum));
        }
    }, [status, ethereum]);

    const [chainState, setChainState] = useState<ChainState | undefined>(
        undefined
    );

    useEffect(() => {
        async function refreshChainState() {
            if (web3 !== undefined && account !== null) {
                setChainState({
                    accountBaseBalance: await getBalance(
                        web3,
                        CONFIG.baseToken.erc20Address,
                        account
                    ),
                    accountQuoteBalance: await getBalance(
                        web3,
                        CONFIG.quoteToken.erc20Address,
                        account
                    ),
                    poolBaseBalance: await getBalance(
                        web3,
                        CONFIG.baseToken.erc20Address,
                        CONFIG.swapContractAddress
                    ),
                    poolQuoteBalance: await getBalance(
                        web3,
                        CONFIG.quoteToken.erc20Address,
                        CONFIG.swapContractAddress
                    ),
                    stakeBaseBalance: await getBalanceInContract(
                        true,
                        web3,
                        CONFIG.swapContractAddress,
                        account,
                    ),
                    stakeQuoteBalance: await getBalanceInContract(
                        false,
                        web3,
                        CONFIG.swapContractAddress,
                        account,
                    ),
                    incentiveTotalBaseBalance: await getTotalIncentive(
                        web3,
                        CONFIG.swapContractAddress,
                        true,
                    ),
                    incentiveTotalQuoteBalance: await getTotalIncentive(
                        web3,
                        CONFIG.swapContractAddress,
                        false,
                    ),
                });
            } else {
                setChainState(undefined);
            }
        }

        const interval = setInterval(refreshChainState, 3000);

        return () => {
            clearInterval(interval);
        };
    }, [web3, account]);

    const [pythOffChainPrice, setPythOffChainPrice] = useState<
        Record<HexString, Price>
    >({});

    // Subscribe to offchain prices. These are the prices that a typical frontend will want to show.
    useEffect(() => {
        // The Pyth price service client is used to retrieve the current Pyth prices and the price update data that
        // needs to be posted on-chain with each transaction.
        const pythPriceService = new EvmPriceServiceConnection(CONFIG.hermesUrl, {
            logger: {
                error: console.error,
                warn: console.warn,
                info: () => undefined,
                debug: () => undefined,
                trace: () => undefined,
            },
        });

        pythPriceService.subscribePriceFeedUpdates(
            [CONFIG.baseToken.pythPriceFeedId, CONFIG.quoteToken.pythPriceFeedId],
            (priceFeed: PriceFeed) => {
                const price = priceFeed.getPriceUnchecked(); // Fine to use unchecked (not checking for staleness) because this must be a recent price given that it comes from a websocket subscription.
                setPythOffChainPrice((prev) => ({...prev, [priceFeed.id]: price}));
            }
        );
    }, []);

    const [exchangeRateMeta, setExchangeRateMeta] = useState<
        ExchangeRateMeta | undefined
    >(undefined);

    useEffect(() => {
        let basePrice = pythOffChainPrice[CONFIG.baseToken.pythPriceFeedId];
        let quotePrice = pythOffChainPrice[CONFIG.quoteToken.pythPriceFeedId];

        if (basePrice !== undefined && quotePrice !== undefined) {
            const exchangeRate =
                basePrice.getPriceAsNumberUnchecked() /
                quotePrice.getPriceAsNumberUnchecked();
            const lastUpdatedTime = new Date(
                Math.max(basePrice.publishTime, quotePrice.publishTime) * 1000
            );
            setExchangeRateMeta({rate: exchangeRate, lastUpdatedTime});
        } else {
            setExchangeRateMeta(undefined);
        }
    }, [pythOffChainPrice]);

    const [time, setTime] = useState<Date>(new Date());

    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000);
        return () => {
            clearInterval(interval);
        };
    }, []);

    const [isBuy, setIsBuy] = useState<boolean>(true);

    return (
        <div className="App">
            <div className="control-panel">
                <h3>Control Panel</h3>

                <div>
                    {status === "connected" ? (
                        <label>
                            Connected Wallet: <br/> {account}
                        </label>
                    ) : (
                        <button
                            onClick={async () => {
                                connect();
                            }}
                        >
                            {" "}
                            Connect Wallet{" "}
                        </button>
                    )}
                </div>

                <div>
                    <h3>Wallet Balances</h3>
                    {chainState !== undefined ? (
                        <div>
                            <p>
                                {tokenQtyToNumber(
                                    chainState.accountBaseBalance,
                                    CONFIG.baseToken.decimals
                                )}{" "}
                                {CONFIG.baseToken.name}
                                <MintButton
                                    web3={web3!}
                                    sender={account!}
                                    erc20Address={CONFIG.baseToken.erc20Address}
                                    destination={account!}
                                    qty={CONFIG.mintQty}
                                    decimals={CONFIG.baseToken.decimals}
                                />
                            </p>
                            <p>
                                {tokenQtyToNumber(
                                    chainState.accountQuoteBalance,
                                    CONFIG.quoteToken.decimals
                                )}{" "}
                                {CONFIG.quoteToken.name}
                                <MintButton
                                    web3={web3!}
                                    sender={account!}
                                    erc20Address={CONFIG.quoteToken.erc20Address}
                                    destination={account!}
                                    qty={CONFIG.mintQty}
                                    decimals={CONFIG.quoteToken.decimals}
                                />
                            </p>
                        </div>
                    ) : (
                        <p>loading...</p>
                    )}
                </div>

                <h3>AMM Balances</h3>
                <div>
                    <p>Contract address: {CONFIG.swapContractAddress}</p>
                    {chainState !== undefined ? (
                        <div>
                            <p>
                                {tokenQtyToNumber(
                                    chainState.poolBaseBalance,
                                    CONFIG.baseToken.decimals
                                )}{" "}
                                {CONFIG.baseToken.name}
                                <MintButton
                                    web3={web3!}
                                    sender={account!}
                                    erc20Address={CONFIG.baseToken.erc20Address}
                                    destination={CONFIG.swapContractAddress}
                                    qty={CONFIG.mintQty}
                                    decimals={CONFIG.baseToken.decimals}
                                />
                            </p>
                            <p>
                                {tokenQtyToNumber(
                                    chainState.poolQuoteBalance,
                                    CONFIG.quoteToken.decimals
                                )}{" "}
                                {CONFIG.quoteToken.name}
                                <MintButton
                                    web3={web3!}
                                    sender={account!}
                                    erc20Address={CONFIG.quoteToken.erc20Address}
                                    destination={CONFIG.swapContractAddress}
                                    qty={CONFIG.mintQty}
                                    decimals={CONFIG.quoteToken.decimals}
                                />
                            </p>
                        </div>
                    ) : (
                        <p>loading...</p>
                    )}
                </div>
                <div>
                    <h3>Deposit/Withdraw</h3>
                    <p>My {CONFIG.baseToken.name} Balance in AMM: {chainState !== undefined ? (
                        <span>
                            {tokenQtyToNumber(
                                chainState.stakeBaseBalance,
                                CONFIG.baseToken.decimals
                            )}{" "}
                            {CONFIG.baseToken.name}
                        </span>) : null
                    }</p>
                    <p>
                        <SendButton
                            web3={web3!}
                            isBaseToken={true}
                            isDeposit={true}
                            sender={account!}
                            erc20Address={CONFIG.baseToken.erc20Address}
                            destination={CONFIG.swapContractAddress}
                            qty={CONFIG.sendQty}
                            decimals={CONFIG.baseToken.decimals}
                        />
                    </p>
                    <p>
                        <SendButton
                            web3={web3!}
                            isBaseToken={true}
                            isDeposit={false}
                            sender={account!}
                            erc20Address={CONFIG.baseToken.erc20Address}
                            destination={CONFIG.swapContractAddress}
                            qty={CONFIG.withdrawQty}
                            decimals={CONFIG.baseToken.decimals}
                        />
                    </p>
                    <p>My {CONFIG.quoteToken.name} Balance in AMM: {chainState !== undefined ? (
                        <span>
                            {tokenQtyToNumber(
                                chainState.stakeQuoteBalance,
                                CONFIG.quoteToken.decimals
                            )}{" "}
                            {CONFIG.quoteToken.name}
                        </span>) : null
                    }</p>
                    <p>
                        <SendButton
                            web3={web3!}
                            isBaseToken={false}
                            isDeposit={true}
                            sender={account!}
                            erc20Address={CONFIG.quoteToken.erc20Address}
                            destination={CONFIG.swapContractAddress}
                            qty={CONFIG.sendQty}
                            decimals={CONFIG.quoteToken.decimals}
                        />
                    </p>
                    <p>
                        <SendButton
                            web3={web3!}
                            isBaseToken={false}
                            isDeposit={false}
                            sender={account!}
                            erc20Address={CONFIG.quoteToken.erc20Address}
                            destination={CONFIG.swapContractAddress}
                            qty={CONFIG.withdrawQty}
                            decimals={CONFIG.quoteToken.decimals}
                        />
                    </p>
                </div>
                <div>
                    <h3>Total Incentive Pool</h3>
                    {chainState !== undefined ? (
                        <div>
                            <p>From buy tx: <span>
                                {tokenQtyToNumber(
                                    chainState.incentiveTotalBaseBalance,
                                    CONFIG.quoteToken.decimals
                                )}{" "}
                                {CONFIG.quoteToken.name}
                                </span>
                            </p>
                            <p>From sell tx: <span>
                                {tokenQtyToNumber(
                                    chainState.incentiveTotalQuoteBalance,
                                    CONFIG.quoteToken.decimals
                                )}{" "}
                                {CONFIG.quoteToken.name}
                                </span>
                            </p>
                        </div>) : null
                    }
                </div>
            </div>

            <div className={"main"}>
                <h3>
                    Swap between {CONFIG.baseToken.name} and {CONFIG.quoteToken.name}
                </h3>
                <PriceText
                    price={pythOffChainPrice}
                    currentTime={time}
                    rate={exchangeRateMeta}
                    baseToken={CONFIG.baseToken}
                    quoteToken={CONFIG.quoteToken}
                />
                <div className="tab-header">
                    <div
                        className={`tab-item ${isBuy ? "active" : ""}`}
                        onClick={() => setIsBuy(true)}
                    >
                        Buy
                    </div>
                    <div
                        className={`tab-item ${!isBuy ? "active" : ""}`}
                        onClick={() => setIsBuy(false)}
                    >
                        Sell
                    </div>
                </div>
                <div className="tab-content">
                    <OrderEntry
                        web3={web3}
                        account={account}
                        isBuy={isBuy}
                        approxPrice={exchangeRateMeta?.rate}
                        baseToken={CONFIG.baseToken}
                        quoteToken={CONFIG.quoteToken}
                        hermesUrl={CONFIG.hermesUrl}
                        pythContractAddress={CONFIG.pythContractAddress}
                        swapContractAddress={CONFIG.swapContractAddress}
                    />
                </div>
            </div>
        </div>
    );
}

export default App;
