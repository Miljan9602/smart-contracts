pragma solidity 0.6.12;

import "./system/HordUpgradable.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";

/**
 * HordConfiguration contract.
 * @author Nikola Madjarevic
 * Date created: 4.8.21.
 * Github: madjarevicn
 */
contract HordConfiguration is HordUpgradable, Initializable {

    // Stating minimal champion stake in USD in order to launch pool
    uint256 minChampStake;
    // Maximal warmup period
    uint256 maxWarmupPeriod;
    // Time for followers to stake and reach MIN/MAX follower etf stake
    uint256 maxFollowerOnboardPeriod;
    // Minimal ETH stake followers should reach together
    uint256 minFollowerEthStake;
    // Maximal ETH stake followers should reach together
    uint256 maxFollowerEthStake;
    // Minimal Stake per pool ticket
    uint256 minStakePerPoolTicket;
    // Percent used for purchasing underlying assets
    uint256 assetUtilizationRatio;
    // Percent for covering gas fees for hPool operations
    uint256 gasUtilizationRatio;
    // Representing % of HORD necessary in every pool
    uint256 platformStakeRatio;
    //
    uint256 maxSupplyHPoolToken;


    event ConfigurationChanged(string parameter, uint256 newValue);

    /**
     * @notice          Initializer function
     */
    function initialize(
        address _hordCongress,
        address _maintainersRegistry,
        uint256 _minChampStake,
        uint256 _maxWarmupPeriod,
        uint256 _maxFollowerOnboardPeriod,
        uint256 _minFollowerEthStake,
        uint256 _minStakePerPoolTicket,
        uint256 _assetUtilizationRatio,
        uint256 _gasUtilizationRatio,
        uint256 _platformStakeRatio,
        uint256 _maxSupplyHPoolToken
    )
    initializer
    external
    {
        // Set hord congress and maintainers registry
        setCongressAndMaintainers(_hordCongress, _maintainersRegistry);

        minChampStake = _minChampStake;
        maxWarmupPeriod = _maxWarmupPeriod;
        maxFollowerOnboardPeriod = _maxFollowerOnboardPeriod;
        minFollowerEthStake = _minFollowerEthStake;
        minStakePerPoolTicket = _minStakePerPoolTicket;
        assetUtilizationRatio = _assetUtilizationRatio;
        gasUtilizationRatio = _gasUtilizationRatio;
        platformStakeRatio = _platformStakeRatio;
        maxSupplyHPoolToken = _maxSupplyHPoolToken;
    }

}
