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
    }

    // Setter Functions
    // _minChampStake setter function
    function setMinChampStake(
        uint256 minChampStake_
    )
    public
    onlyHordCongress
    {
        _minChampStake = minChampStake_;
        emit ConfigurationChanged("_minChampStake", _minChampStake);
    }

    // _maxWarmupPeriod setter function
    function setMaxWarmupPeriod(
        uint256 maxWarmupPeriod_
    )
    public
    onlyHordCongress
    {
        _maxWarmupPeriod = maxWarmupPeriod_;
        emit ConfigurationChanged("_maxWarmupPeriod", _maxWarmupPeriod);
    }

    // _maxFollowerOnboardPeriod setter function
    function setMaxFollowerOnboardPeriod(
        uint256 maxFollowerOnboardPeriod_
    )
    public
    onlyHordCongress
    {
        _maxFollowerOnboardPeriod = maxFollowerOnboardPeriod_;
        emit ConfigurationChanged("_maxFollowerOnboardPeriod", _maxFollowerOnboardPeriod);
    }

    // _minFollowerEthStake setter function
    function setMinFollowerEthStake(
        uint256 minFollowerEthStake_
    )
    public
    onlyHordCongress
    {
        _minFollowerEthStake = minFollowerEthStake_;
        emit ConfigurationChanged("_minFollowerEthStake", _minFollowerEthStake);
    }

    // _maxFollowerEthStake setter function
    function setMaxFollowerEthStake(
        uint256 maxFollowerEthStake_
    )
    public
    onlyHordCongress
    {
        _maxFollowerEthStake = maxFollowerEthStake_;
        emit ConfigurationChanged("_maxFollowerEthStake", _maxFollowerEthStake);
    }

    // _minStakePerPoolTicket setter function
    function setMinStakePerPoolTicket(
        uint256 minStakePerPoolTicket_
    )
    public
    onlyHordCongress
    {
        _minStakePerPoolTicket = minStakePerPoolTicket_;
        emit ConfigurationChanged("_minStakePerPoolTicket", _minStakePerPoolTicket);
    }

    // _assetUtilizationRatio setter function
    function setAssetUtilizationRatio(
        uint256 assetUtilizationRatio_
    )
    public
    onlyHordCongress
    {
        _assetUtilizationRatio = assetUtilizationRatio_;
        emit ConfigurationChanged("_assetUtilizationRatio", _assetUtilizationRatio);
    }

    // _gasUtilizationRatio setter function
    function setGasUtilizationRatio(
        uint256 gasUtilizationRatio_
    )
    public
    onlyHordCongress
    {
        _gasUtilizationRatio = gasUtilizationRatio_;
        emit ConfigurationChanged("_gasUtilizationRatio", _gasUtilizationRatio);
    }

    // _platformStakeRatio setter function
    function setPlatformStakeRatio(
        uint256 platformStakeRatio_
    )
    public
    onlyHordCongress
    {
        _platformStakeRatio = platformStakeRatio_;
        emit ConfigurationChanged("_platformStakeRatio", _platformStakeRatio);
    }

    // _maxSupplyHPoolToken setter function
    function setMaxSupplyHPoolToken(
        uint256 maxSupplyHPoolToken_
    )
    public
    onlyHordCongress
    {
        _maxSupplyHPoolToken = maxSupplyHPoolToken_;
        emit ConfigurationChanged("_maxSupplyHPoolToken", _maxSupplyHPoolToken);
    }


    // Getter Functions
    // _minChampStake getter function
    function minChampStake() public view returns(uint256) {
        return _minChampStake;
    }

    // _maxWarmupPeriod getter function
    function maxWarmupPeriod() public view returns(uint256) {
        return _maxWarmupPeriod;
    }

    // _maxFollowerOnboardPeriod getter function
    function maxFollowerOnboardPeriod() public view returns(uint256) {
        return _maxFollowerOnboardPeriod;
    }

    // _minFollowerEthStake getter function
    function minFollowerEthStake() public view returns(uint256) {
        return _minFollowerEthStake;
    }

    // _maxFollowerEthStake getter function
    function maxFollowerEthStake() public view returns(uint256) {
        return _maxFollowerEthStake;
    }

    // _minStakePerPoolTicket getter function
    function minStakePerPoolTicket() public view returns(uint256) {
        return _minStakePerPoolTicket;
    }

    // _assetUtilizationRatio getter function
    function assetUtilizationRatio() public view returns(uint256) {
        return _assetUtilizationRatio;
    }

    // _gasUtilizationRatio getter function
    function gasUtilizationRatio() public view returns(uint256) {
        return _gasUtilizationRatio;
    }

    // _platformStakeRatio getter function
    function platformStakeRatio() public view returns(uint256) {
        return _platformStakeRatio;
    }

    // _maxSupplyHPoolToken getter function
    function maxSupplyHPoolToken() public view returns(uint256) {
        return _maxSupplyHPoolToken;
    }
}
