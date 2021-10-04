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

    struct BuyOrderRatio {
        address dstToken;
        uint256 ratio;
    }

    struct TradeOrder {
        address srcToken;
        address dstToken;
        uint256 amountSrc;
    }

    struct SellLimit{
        address srcToken;
        address dstToken;
        uint256 priceUSD;
        uint256 amountSrc;
        uint256 validUntil;
    }

    struct BuyLimit{
        address srcToken;
        address dstToken;
        uint256 priceUSD;
        uint256 amountUSD;
        uint256 validUntil;
    }


    string public constant EIP712_DOMAIN =
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";
    string public constant BUY_ORDER_RATIO_TYPE = "BuyOrderRatio(address dstToken,uint256 ratio)";
    string public constant TRADE_ORDER_TYPE = "TradeOrder(address srcToken,address dstToken,uint256 amountSrc)";
    string public constant SELL_LIMIT_TYPE =
        "SellLimit(address srcToken,address dstToken,uint256 priceUSD,uint256 amountSrc,uint256 validUntil)";
    string public constant BUY_LIMIT_TYPE =
        "BuyLimit(address srcToken,address dstToken,uint256 priceUSD,uint256 amountUSD,uint256 validUntil)";


    // Compute typehashes
    bytes32 public constant EIP712_DOMAIN_TYPEHASH = keccak256(abi.encodePacked(EIP712_DOMAIN));
    bytes32 public constant BUY_ORDER_RATIO_TYPEHASH = keccak256(abi.encodePacked(BUY_ORDER_RATIO_TYPE));
    bytes32 public constant TRADE_ORDER_TYPEHASH = keccak256(abi.encodePacked(TRADE_ORDER_TYPE));
    bytes32 public constant SELL_LIMIT_TYPEHASH = keccak256(abi.encodePacked(SELL_LIMIT_TYPE));
    bytes32 public constant BUY_LIMIT_TYPEHASH = keccak256(abi.encodePacked(BUY_LIMIT_TYPE));

    bytes32 public DOMAIN_SEPARATOR;

    /* if chainId is not a constant and instead dynamically initialized,
     * the hash calculation seems to be off and ecrecover() returns an unexpected signing address
    // uint256 internal chainId;
    // constructor(uint256 _chainId) public{
    //     chainId = _chainId;
    // }
    */

    constructor() public {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256("Hord.app"), // string name
                keccak256("1"), // string version
                chainId, // uint256 chainId
                address(this) // address verifyingContract
            )
        );
    }

//
//    function recoverSigner(
//        address srcToken,
//        address dstToken,
//        uint256 ratioFromPool,
//        uint256 amountSrc,
//        uint256 minReceivedDst,
//        uint256 validUntil,
//        bytes32 sigV,
//        bytes32 sigR,
//        uint8 sigS
//    ) external view returns (address) {
//        // Build tradeOrder structure based on the params
//        TradeOrder memory tradeOrder = TradeOrder(
//            srcToken,
//            dstToken,
//            ratioFromPool,
//            amountSrc,
//            minReceivedDst,
//            validUntil
//        );
//        // Verify who signed the message
//        return recoverSignature(tradeOrder, sigV, sigR, sigS);
//    }

    // functions to generate hash representation of the BuyOrderRatio struct
    function hashBuyOrderRatio(BuyOrderRatio memory buyOrderRatio)
        internal
        view
        returns (bytes32)
    {
        return
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR,
                    keccak256(
                        abi.encode(
                            BUY_ORDER_RATIO_TYPEHASH,
                            buyOrderRatio.dstToken,
                            buyOrderRatio.ratio
                        )
                    )
                )
            );
    }

    function recoverSignatureBuyOrderRatio(
        BuyOrderRatio memory _msg,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    )
    external
    view
    returns (address)
    {
        return ecrecover(hashBuyOrderRatio(_msg), sigV, sigR, sigS);
    }

    // functions to generate hash representation of the TradeOrder struct
    function hashTradeOrder(TradeOrder memory tradeOrder)
    internal
    view
    returns (bytes32)
    {
        return
        keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(
                        TRADE_ORDER_TYPEHASH,
                        tradeOrder.srcToken,
                        tradeOrder.dstToken,
                        tradeOrder.amountSrc
                    )
                )
            )
        );
    }

    function recoverSignatureTradeOrder(
        TradeOrder memory _msg,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    )
    external
    view
    returns (address)
    {
        return ecrecover(hashTradeOrder(_msg), sigV, sigR, sigS);
    }

    // functions to generate hash representation of the SellLimit struct
    function hashSellLimit(SellLimit memory sellLimit)
    internal
    view
    returns (bytes32)
    {
        return
        keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(
                        SELL_LIMIT_TYPEHASH,
                        sellLimit.srcToken,
                        sellLimit.dstToken,
                        sellLimit.priceUSD,
                        sellLimit.amountSrc,
                        sellLimit.validUntil
                    )
                )
            )
        );
    }

    function recoverSignatureSellLimit(
        SellLimit memory _msg,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    )
    external
    view
    returns (address)
    {
        return ecrecover(hashSellLimit(_msg), sigV, sigR, sigS);
    }

    // functions to generate hash representation of the BuyLimit struct
    function hashBuyLimit(BuyLimit memory buyLimit)
    internal
    view
    returns (bytes32)
    {
        return
        keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(
                        BUY_LIMIT_TYPEHASH,
                        buyLimit.srcToken,
                        buyLimit.dstToken,
                        buyLimit.priceUSD,
                        buyLimit.amountUSD,
                        buyLimit.validUntil
                    )
                )
            )
        );
    }

    function recoverSignatureBuyLimit(
        BuyLimit memory _msg,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    )
    external
    view
    returns (address)
    {
        return ecrecover(hashBuyLimit(_msg), sigV, sigR, sigS);
    }

}
