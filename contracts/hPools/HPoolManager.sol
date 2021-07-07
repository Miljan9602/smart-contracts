pragma solidity 0.6.12;

import "../system/HordMiddleware.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "../interfaces/AggregatorV3Interface.sol";
import "../libraries/SafeMath.sol";

/**
 * HPoolManager contract.
 * @author Nikola Madjarevic
 * Date created: 7.7.21.
 * Github: madjarevicn
 */
contract HPoolManager is PausableUpgradeable, HordMiddleware {

    using SafeMath for *;


    enum PoolState {PENDING_INIT, TICKET_SALE, SUBSCRIPTION}


    uint256 public minUSDToInitPool;
    uint256 public maxUSDAllocationPerTicket;
    uint256 public constant one = 10e18;


    struct Subscription {
        address user;
        uint256 amountEth;
    }

    struct hPool {
        PoolState poolState;
        uint256 championEthDeposit;
        address championAddress;
        uint256 createdAt;
        uint256 nftTicketId;
        bool isValidated;
        uint256 followersEthDeposit;
        address hPoolAddress;
    }

    // Instance of oracle
    AggregatorV3Interface linkOracle;

    // All hPools
    hPool [] hPools;

    // Map pool Id to all subscriptions
    mapping(uint256 => Subscription[]) poolIdToSubscriptions;

    // Mapping user to ids of all pools he has subscribed for
    mapping(address => uint256[]) userToPoolIdsSubscribedFor;

    // Support listing pools per champion
    mapping (address => uint[]) championAddressToHPoolIds;

    /**
     * Events
     */
    event PoolInitRequested(uint256 poolId, address champion, uint256 championEthDeposit, uint256 timestamp);
    event AggregatorInterfaceSet(address oracleAddress);
    event TicketIdSetForPool(uint256 poolId, uint256 nftTicketId);
    event HPoolStateChanged(uint256 poolId, PoolState newState);
    event MinimalUSDToInitPoolSet(uint256 newMinimalAmountToInitPool);
    event MaximalUSDAllocationPerTicket(uint256 newMaximalAllocationPerTicket);


    function initialize () initializer external {
//        setCongressAndMaintainers(_hordCongress, _maintainersRegistry);
    }


    function setAggregatorInterface(
        address linkOracleAddress
    )
    external
    onlyMaintainer
    {
        require(linkOracleAddress != address(0), "Link oracle address can not be 0x0.");
        linkOracle = AggregatorV3Interface(linkOracleAddress);

        emit AggregatorInterfaceSet(linkOracleAddress);
    }


    function setMinimalUSDToInitPool(
        uint256 _minUSDToInitPool
    )
    external
    onlyMaintainer
    {
        require(_minUSDToInitPool != 0 , "Minimal USD to init pool must be > 0");
        minUSDToInitPool = _minUSDToInitPool;

        emit MinimalUSDToInitPoolSet(minUSDToInitPool);
    }


    function setMaxUSDAllocationPerTicket(
        uint256 _maxUSDAllocationPerTicket
    )
    external
    onlyMaintainer
    {
        require(_maxUSDAllocationPerTicket != 0 , "Maximal USD allocation per ticket can not be 0.");
        maxUSDAllocationPerTicket = _maxUSDAllocationPerTicket;

        emit MaximalUSDAllocationPerTicket(maxUSDAllocationPerTicket);
    }

    function createHPool()
    external
    payable
    whenNotPaused
    {
        // Requirements
        require(msg.sender == tx.origin, "Only direct contract calls.");
        require(msg.value >= getMinimalETHToInitPool(), "ETH amount is less than minimal deposit.");

        // Create hPool structure
        hPool memory hp;

        hp.poolState= PoolState.PENDING_INIT;
        hp.championEthDeposit= msg.value;
        hp.championAddress= msg.sender;
        hp.createdAt= block.timestamp;

        // Compute ID to match position in array
        uint poolId = hPools.length;
        // Push hPool structure
        hPools.push(hp);

        // Add Id to list of ids for champion
        championAddressToHPoolIds[msg.sender].push(poolId);

        // Trigger events
        emit PoolInitRequested(poolId, msg.sender, msg.value, block.timestamp);
        emit HPoolStateChanged(poolId, hp.poolState);
    }


    /**
     * @notice          Function to set NFT for pool, which will at the same time validate the pool itself.
     * @param           poolId is the ID of the pool contract.
     */
    function setNftForPool(
        uint poolId,
        uint _nftTicketId
    )
    external
    onlyMaintainer
    {

        require(poolId < hPools.length, "hPool with poolId does not exist.");
        require(_nftTicketId > 0, "NFT id can not be 0.");

        hPool storage hp = hPools[poolId];

        require(!hp.isValidated, "hPool already validated.");
        require(hp.poolState == PoolState.PENDING_INIT, "Bad state transition.");

        hp.isValidated = true;
        hp.nftTicketId = _nftTicketId;
        hp.poolState = PoolState.TICKET_SALE;

        emit TicketIdSetForPool(poolId, hp.nftTicketId);
        emit HPoolStateChanged(poolId, hp.poolState);
    }


    /**
     * @notice          Function to start subscription phase. Can be started only if previous
     *                  state of the hPool was TICKET_SALE.
     * @param           poolId is the ID of the pool contract.
     */
    function startSubscriptionPhase(
        uint poolId
    )
    external
    onlyMaintainer
    {
        require(poolId < hPools.length, "hPool with poolId does not exist.");

        hPool storage hp = hPools[poolId];

        require(hp.poolState == PoolState.TICKET_SALE, "Bad state transition.");
        hp.poolState = PoolState.SUBSCRIPTION;

        emit HPoolStateChanged(poolId, hp.poolState);
    }

    function subscribeForHPool(
        uint poolId
    )
    external
    payable
    {

    }

    /**
     * @notice          Function to get minimal amount of ETH champion needs to
     *                  put in, in order to create hPool.
     * @return         Amount of ETH (in WEI units)
     */
    function getMinimalETHToInitPool()
    public
    view
    returns (uint256)
    {
        uint256 latestPrice = uint256(getLatestPrice());
        uint256 usdEThRate = one.mul(one).div(latestPrice);
        return usdEThRate.mul(minUSDToInitPool).div(one);
    }


    /**
     * @notice          Function to get maximal amount of ETH user can subscribe with
     *                  per 1 access ticket
     * @return         Amount of ETH (in WEI units)
     */
    function getMaxSubscriptionInETHPerTicket()
    public
    view
    returns (uint256)
    {
        uint256 latestPrice = uint256(getLatestPrice());
        uint256 usdEThRate = one.mul(one).div(latestPrice);
        return usdEThRate.mul(maxUSDAllocationPerTicket).div(one);
    }


    /**
     * @notice          Function to fetch the latest price of the stored oracle.
     */
    function getLatestPrice()
    public
    view
    returns (int)
    {
        (,int price,,,) = linkOracle.latestRoundData();
        return price;
    }


    /**
     * @notice          Function to fetch on how many decimals is the response
     */
    function getDecimalsReturnPrecision()
    public
    view
    returns (uint8)
    {
        return linkOracle.decimals();
    }


    /**
     * @notice          Function to get IDs of all pools for the champion.
     */
    function getChampionPoolIds(
        address champion
    )
    external
    view
    returns (uint256 [] memory)
    {
        return championAddressToHPoolIds[champion];
    }
}
