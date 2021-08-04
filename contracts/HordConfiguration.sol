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
    uint256 _minChampStake;
    // Maximal warmup period
    uint256 _maxWarmupPeriod;
    // Time for followers to stake and reach MIN/MAX follower etf stake
    uint256 _maxFollowerOnboardPeriod;
    // Minimal ETH stake followers should reach together
    uint256 _minFollowerEthStake;
    // Maximal ETH stake followers should reach together
    uint256 _maxFollowerEthStake;
    // Minimal Stake per pool ticket
    uint256 _minStakePerPoolTicket;
    // Percent used for purchasing underlying assets
    uint256 _assetUtilizationRatio;
    // Percent for covering gas fees for hPool operations
    uint256 _gasUtilizationRatio;
    // Representing % of HORD necessary in every pool
    uint256 _platformStakeRatio;
    //
    uint256 _maxSupplyHPoolToken;


    event ConfigurationChanged(string parameter, uint256 newValue);

    /**
     * @notice          Initializer function
     */
    function initialize(
        address hordCongress_,
        address maintainersRegistry_,
        uint256 minChampStake_,
        uint256 maxWarmupPeriod_,
        uint256 maxFollowerOnboardPeriod_,
        uint256 minFollowerEthStake_,
        uint256 minStakePerPoolTicket_,
        uint256 assetUtilizationRatio_,
        uint256 gasUtilizationRatio_,
        uint256 platformStakeRatio_,
        uint256 maxSupplyHPoolToken_
    )
    initializer
    external
    {
        // Set hord congress and maintainers registry
        setCongressAndMaintainers(_hordCongress, _maintainersRegistry);

        _minChampStake = minChampStake_;
        _maxWarmupPeriod = maxWarmupPeriod_;
        _maxFollowerOnboardPeriod = maxFollowerOnboardPeriod_;
        _minFollowerEthStake = minFollowerEthStake_;
        _minStakePerPoolTicket = minStakePerPoolTicket_;
        _assetUtilizationRatio = assetUtilizationRatio_;
        _gasUtilizationRatio = gasUtilizationRatio_;
        _platformStakeRatio = platformStakeRatio_;
        _maxSupplyHPoolToken = maxSupplyHPoolToken_;
    }

}
