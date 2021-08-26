pragma solidity ^0.6.12;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";


/**
 * IHordTicketFactory contract.
 * @author Nikola Madjarevic
 * Date created: 11.5.21.
 * Github: madjarevicn
 */
interface IHordTicketFactory is IERC1155 {
    function getTokenSupply(uint tokenId) external view returns (uint256);
    function lastMintedTokenId() external view returns (uint256);
}
