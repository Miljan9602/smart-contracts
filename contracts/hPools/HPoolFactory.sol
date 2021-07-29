pragma solidity 0.6.12;

import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "../system/HordMiddleware.sol";

import "./HPool.sol";

/**
 * HPoolFactory contract.
 * @author Nikola Madjarevic
 * Date created: 29.7.21.
 * Github: madjarevicn
 */
contract HPoolFactory is PausableUpgradeable, HordMiddleware {

    address public hPoolManager;
    address [] deployedHPools;

    modifier onlyHPoolManager {
        require(msg.sender == hPoolManager);
        _;
    }

    /**
     * @notice          Function to deploy hPool, only callable by HPoolManager
     */
    function deployHPool()
    external
    onlyHPoolManager
    returns (address)
    {
        // Deploy the HPool contract
        HPool hpContract = new HPool(hordCongress, address(maintainersRegistry), hPoolManager);

        // Add deployed pool to array of deployed pools
        deployedHPools.push(address(hpContract));

        // Return deployed hPool address
        return address(hpContract);
    }

    /**
     * @notice          Function to get array of deployed pool addresses
     * @param           startIndex is the start index for query
     * @param           endIndex is the end index for query
     *                  As an example to fetch [2,3,4,5] elements in array input will be (2,6)
     */
    function getDeployedHPools(uint startIndex, uint endIndex)
    external
    view
    returns (address[])
    {
        address [] memory hPools = new address[](startIndex - endIndex);
        uint counter;

        for(uint i = startIndex; i < endIndex; i++) {
            hPools[counter] = deployedHPools[i];
            counter++;
        }

        return deployedHPools;
    }

}
