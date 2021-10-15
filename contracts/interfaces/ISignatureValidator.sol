pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

/**
 * ISignatureValidator contract.
 * @author Nikola Madjarevic
 * Date created: 30.9.21.
 * Github: madjarevicn
 */
interface ISignatureValidator {

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

    function recoverSignatureBuyOrderRatio(
        BuyOrderRatio memory _msg,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    ) external view returns (address);

    function recoverSignatureTradeOrder(
        TradeOrder memory _msg,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    ) external view returns (address);

    function recoverSignatureSellLimit(
        SellLimit memory _msg,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    ) external view returns (address);

    function recoverSignatureBuyLimit(
        BuyLimit memory _msg,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    ) external view returns (address);

}

