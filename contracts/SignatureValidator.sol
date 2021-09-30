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
    //    enum TradeType {MarketOrderLaunch, MarketOrder, StopLoss, BuyLimit, TakeProfit}

    struct TradeOrder {
        //        TradeType type;
        address srcToken;
        address dstToken;
        uint256 ratioFromPool;
        uint256 amountSrc;
        uint256 minReceivedDst;
        uint256 validUntil;
    }

    string public constant EIP712_DOMAIN =
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";

    string public constant TRADE_ORDER_TYPE =
        "TradeOrder(address srcToken,address dstToken,uint256 ratioFromPool,uint256 amountSrc,uint256 minReceivedDst,uint256 validUntil)";

    // type hashes. Hash of the following strings:
    // 1. EIP712 Domain separator.
    // 2. string describing identity type
    // 3. string describing message type (enclosed identity type description included in the string)

    bytes32 public constant EIP712_DOMAIN_TYPEHASH =
        keccak256(abi.encodePacked(EIP712_DOMAIN));
    bytes32 public constant TRADE_ORDER_TYPEHASH =
        keccak256(abi.encodePacked(TRADE_ORDER_TYPE));

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

    // functions to generate hash representation of the struct objects
    function hashTradeOrder(TradeOrder memory tradeOrder)
        public
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
                            tradeOrder.ratioFromPool,
                            tradeOrder.amountSrc,
                            tradeOrder.minReceivedDst,
                            tradeOrder.validUntil
                        )
                    )
                )
            );
    }

    function recoverSignature(
        TradeOrder memory _msg,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    ) external view returns (address) {
        return ecrecover(hashTradeOrder(_msg), sigV, sigR, sigS);
    }
}
