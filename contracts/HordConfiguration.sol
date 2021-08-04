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
    // Minimal ETH stake followers should reach together, in USD
    uint256 _minFollowerEthStake;
    // Maximal ETH stake followers should reach together, in USD
    uint256 _maxFollowerEthStake;
    // Minimal Stake per pool ticket
    uint256 _minStakePerPoolTicket;
    // Percent used for purchasing underlying assets
    uint256 _assetUtilizationRatio;
    // Percent for covering gas fees for hPool operations
    uint256 _gasUtilizationRatio;
    // Representing % of HORD necessary in every pool
    uint256 _platformStakeRatio;
    // Representing decimals precision for %, defaults to 100
    uint256 _percentPrecision;
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
        setCongressAndMaintainers(hordCongress_, maintainersRegistry_);

        _minChampStake = minChampStake_;
        _maxWarmupPeriod = maxWarmupPeriod_;
        _maxFollowerOnboardPeriod = maxFollowerOnboardPeriod_;
        _minFollowerEthStake = minFollowerEthStake_;
        _minStakePerPoolTicket = minStakePerPoolTicket_;
        _assetUtilizationRatio = assetUtilizationRatio_;
        _gasUtilizationRatio = gasUtilizationRatio_;
        _platformStakeRatio = platformStakeRatio_;
        _maxSupplyHPoolToken = maxSupplyHPoolToken_;

        _percentPrecision = 100;
    }

    // Setter Functions
    // _minChampStake setter function
    function setMinChampStake(
        uint256 minChampStake_
    )
    external
    onlyHordCongress
    {
        _minChampStake = minChampStake_;
        emit ConfigurationChanged("_minChampStake", _minChampStake);
    }

    // _maxWarmupPeriod setter function
    function setMaxWarmupPeriod(
        uint256 maxWarmupPeriod_
    )
    external
    onlyHordCongress
    {
        _maxWarmupPeriod = maxWarmupPeriod_;
        emit ConfigurationChanged("_maxWarmupPeriod", _maxWarmupPeriod);
    }

    // _maxFollowerOnboardPeriod setter function
    function setMaxFollowerOnboardPeriod(
        uint256 maxFollowerOnboardPeriod_
    )
    external
    onlyHordCongress
    {
        _maxFollowerOnboardPeriod = maxFollowerOnboardPeriod_;
        emit ConfigurationChanged("_maxFollowerOnboardPeriod", _maxFollowerOnboardPeriod);
    }

    // _minFollowerEthStake setter function
    function setMinFollowerEthStake(
        uint256 minFollowerEthStake_
    )
    external
    onlyHordCongress
    {
        _minFollowerEthStake = minFollowerEthStake_;
        emit ConfigurationChanged("_minFollowerEthStake", _minFollowerEthStake);
    }

    // _maxFollowerEthStake setter function
    function setMaxFollowerEthStake(
        uint256 maxFollowerEthStake_
    )
    external
    onlyHordCongress
    {
        _maxFollowerEthStake = maxFollowerEthStake_;
        emit ConfigurationChanged("_maxFollowerEthStake", _maxFollowerEthStake);
    }

    // _minStakePerPoolTicket setter function
    function setMinStakePerPoolTicket(
        uint256 minStakePerPoolTicket_
    )
    external
    onlyHordCongress
    {
        _minStakePerPoolTicket = minStakePerPoolTicket_;
        emit ConfigurationChanged("_minStakePerPoolTicket", _minStakePerPoolTicket);
    }

    // _assetUtilizationRatio setter function
    function setAssetUtilizationRatio(
        uint256 assetUtilizationRatio_
    )
    external
    onlyHordCongress
    {
        _assetUtilizationRatio = assetUtilizationRatio_;
        emit ConfigurationChanged("_assetUtilizationRatio", _assetUtilizationRatio);
    }

    // _gasUtilizationRatio setter function
    function setGasUtilizationRatio(
        uint256 gasUtilizationRatio_
    )
    external
    onlyHordCongress
    {
        _gasUtilizationRatio = gasUtilizationRatio_;
        emit ConfigurationChanged("_gasUtilizationRatio", _gasUtilizationRatio);
    }

    // _platformStakeRatio setter function
    function setPlatformStakeRatio(
        uint256 platformStakeRatio_
    )
    external
    onlyHordCongress
    {
        _platformStakeRatio = platformStakeRatio_;
        emit ConfigurationChanged("_platformStakeRatio", _platformStakeRatio);
    }

    // Set percent precision
    function setPercentPrecision(
        uint256 percentPrecision_
    )
    external
    onlyHordCongress
    {
        _percentPrecision = percentPrecision_;
        emit ConfigurationChanged("_percentPrecision", _percentPrecision);
    }

    // _maxSupplyHPoolToken setter function
    function setMaxSupplyHPoolToken(
        uint256 maxSupplyHPoolToken_
    )
    external
    onlyHordCongress
    {
        _maxSupplyHPoolToken = maxSupplyHPoolToken_;
        emit ConfigurationChanged("_maxSupplyHPoolToken", _maxSupplyHPoolToken);
    }


    // Getter Functions
    // _minChampStake getter function
    function minChampStake() external view returns(uint256) {
        return _minChampStake;
    }

    // _maxWarmupPeriod getter function
    function maxWarmupPeriod() external view returns(uint256) {
        return _maxWarmupPeriod;
    }

    // _maxFollowerOnboardPeriod getter function
    function maxFollowerOnboardPeriod() external view returns(uint256) {
        return _maxFollowerOnboardPeriod;
    }

    // _minFollowerEthStake getter function
    function minFollowerEthStake() external view returns(uint256) {
        return _minFollowerEthStake;
    }

    // _maxFollowerEthStake getter function
    function maxFollowerEthStake() external view returns(uint256) {
        return _maxFollowerEthStake;
    }

    // _minStakePerPoolTicket getter function
    function minStakePerPoolTicket() external view returns(uint256) {
        return _minStakePerPoolTicket;
    }

    // _assetUtilizationRatio getter function
    function assetUtilizationRatio() external view returns(uint256) {
        return _assetUtilizationRatio;
    }

    // _gasUtilizationRatio getter function
    function gasUtilizationRatio() external view returns(uint256) {
        return _gasUtilizationRatio;
    }

    // _platformStakeRatio getter function
    function platformStakeRatio() external view returns(uint256) {
        return _platformStakeRatio;
    }

    // _percentPrecision getter function
    function percentPrecision() external view returns (uint256) {
        return _percentPrecision;
    }

    // _maxSupplyHPoolToken getter function
    function maxSupplyHPoolToken() external view returns(uint256) {
        return _maxSupplyHPoolToken;
    }

}
