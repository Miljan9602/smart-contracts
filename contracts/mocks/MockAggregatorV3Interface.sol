pragma solidity 0.6.12;

/**
 * MockAggregatorV3Interface contract.
 * @author Nikola Madjarevic
 * Date created: 4.8.21.
 * Github: madjarevicn
 */
contract MockAggregatorV3Interface {

    function latestRoundData()
    external
    view
    returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    )
    {
        return (
            0,
            2500 * 10e18,
            0,
            0,
            0
        );
    }
}
