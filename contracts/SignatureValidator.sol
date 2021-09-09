pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

/**
 * SignatureValidator contract.
 * @author Nikola Madjarevic
 * Date created: 8.9.21.
 * Github: madjarevicn
 */
contract SignatureValidator {

    uint256 constant chainId = 3;

    struct TradeOrder {
        address srcToken;
        address dstToken;
    }

    //everything sold for eth and bought from eth
    //1. initial purchase - struct = BuyOrderRatio (dstToken, ratio) - backend will submit actual ETH amount to buy with, and contract can verify that ETH is ~within 5% of the ratio signed by champion
    //2. ongoing purchase - struct = TradeOrder (srcToken, dstToken, amountSource)
    //3. stoploss - struct = StopLoss(srcToken,dstToken,price_usd,amountSource,valid_until)
    //4. buyLimit - struct = BuyLimiT(srcToken,dstToken, price_usd,amount_usd,valid_until) (takeProfit)
    //5. sellLimit - struct - SellLimit(srcToken,dstToken, price_usd, amountSource,valid_until)

    //generalStruct TradeOrder(TradeType,srcToken,dstToken,ratioFromPool,amountSource,amountUSD,priceUSD,validUntil)
    //TradeType {MarketOrderLaunch,MarketOrder,StopLoss,BuyLimit,TakeProfit}


    string public constant EIP712_DOMAIN  = "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";
    string public constant TRADE_ORDER_TYPE = "TradeOrder(address srcToken,address dstToken)";

    // type hashes. Hash of the following strings:
    // 1. EIP712 Domain separator.
    // 2. string describing identity type
    // 3. string describing message type (enclosed identity type description included in the string)

    bytes32 public constant EIP712_DOMAIN_TYPEHASH = keccak256(abi.encodePacked(EIP712_DOMAIN));
    bytes32 public constant TRADE_ORDER_TYPEHASH = keccak256(abi.encodePacked(TRADE_ORDER_TYPE));

    bytes32 public DOMAIN_SEPARATOR;

    /* if chainId is not a constant and instead dynamically initialized,
     * the hash calculation seems to be off and ecrecover() returns an unexpected signing address
    // uint256 internal chainId;
    // constructor(uint256 _chainId) public{
    //     chainId = _chainId;
    // }
    */

    constructor () public {
        DOMAIN_SEPARATOR = keccak256(abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256("TestApp1"),  // string name
                keccak256("1"),  // string version
                chainId,  // uint256 chainId
                address(this)  // address verifyingContract
            ));
    }

    // functions to generate hash representation of the struct objects

    function hashUnit(TradeOrder memory tradeOrder) private view returns (bytes32) {
        return keccak256(abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(
                    TRADE_ORDER_TYPEHASH,
                    tradeOrder.srcToken,
                    tradeOrder.dstToken
                ))
            ));
    }

    function submitProof(TradeOrder memory _msg, bytes32 sigR, bytes32 sigS, uint8 sigV) public view returns (address){
        address recovered_signer = ecrecover(hashUnit(_msg), sigV, sigR, sigS);
        return recovered_signer;
    }
}
