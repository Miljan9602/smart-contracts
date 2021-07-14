pragma solidity 0.6.12;

/**
 * IHordTreasury contract.
 * @author Nikola Madjarevic
 * Date created: 14.7.21.
 * Github: madjarevicn
 */
interface IHordTreasury {
    function depositToken(address token, uint256 amount) external;
}
