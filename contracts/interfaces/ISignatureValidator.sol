pragma solidity 0.6.12;

/**
 * ISignatureValidator contract.
 * @author Nikola Madjarevic
 * Date created: 30.9.21.
 * Github: madjarevicn
 */
interface ISignatureValidator {
    function recoverSigner(
        address srcToken,
        address dstToken,
        uint256 ratioFromPool,
        uint256 amountSrc,
        uint256 minReceivedDst,
        uint256 validUntil,
        bytes32 sigV,
        bytes32 sigR,
        uint8 sigS
    ) external view returns (address);
}
