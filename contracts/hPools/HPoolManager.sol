pragma solidity 0.6.12;

import "../system/HordMiddleware.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "../interfaces/AggregatorV3Interface.sol";
import "../libraries/SafeMath.sol";
import "../interfaces/IHordTicketFactory.sol";

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

    // Instance of hord ticket factory
    IHordTicketFactory hordTicketFactory;

    // All hPools
    hPool [] hPools;

    // Map pool Id to all subscriptions
    mapping(uint256 => Subscription[]) poolIdToSubscriptions;
    // Map user address to pool id to his subscription for that pool
    mapping(address => mapping(uint256 => Subscription)) userToPoolIdToSubscription;
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


    /**
     * @notice          Initializer function, can be called only once, replacing constructor
     * @param           _hordCongress is the address of HordCongress contract
     * @param           _maintainersRegistry is the address of the MaintainersRegistry contract
     */
    function initialize (
        address _hordCongress,
        address _maintainersRegistry,
        address _hordTicketFactory
    )
    initializer
    external
    {
        require(_hordCongress != address(0), "HordCongress address can not be 0x0.");
        require(_maintainersRegistry != address(0), "MaintainersRegistry address can not be 0x0.");
        require(_hordTicketFactory != address(0), "HordTicketFactory address can not be 0x0.");

        setCongressAndMaintainers(_hordCongress, _maintainersRegistry);
        hordTicketFactory = IHordTicketFactory(_hordTicketFactory);
    }


    /**
     * @notice          Function to set Chainlink Aggregator address
     * @param           linkOracleAddress is the address of the oracle we're using.
     */
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


    /**
     * @notice          Function to set minimal usd required for initializing pool
     * @param           _minUSDToInitPool represents minimal amount of USD which is required to init pool, in WEI
     */
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


    /**
     * @notice          Function to set maximal USD allocation per NFT ticket holding
     * @param           _maxUSDAllocationPerTicket is the maximal allocation in USD user can subscribe per ticket.
     */
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


    /**
     * @notice          Function where champion can create his pool.
     *                  In case champion is not approved, maintainer can cancel his pool creation,
     *                  and return him back the funds.
     */
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


    /**
     * @notice          Function to get IDs of pools for which user subscribed
     */
    function getPoolsUserSubscribedFor(
        address user
    )
    external
    view
    returns (uint256 [] memory)
    {
        return userToPoolIdsSubscribedFor[user];
    }

    /**
     * @notice          Function to compute how much user can currently subscribe in ETH for the hPool.
     */
    function getMaxUserSubscriptionInETH(
        address user,
        uint256 poolId
    )
    public
    view
    returns (uint256)
    {
        hPool memory hp = hPools[poolId];

        uint256 amountOfTickets = hordTicketFactory.balanceOf(user, hp.nftTicketId);
        uint256 maxUserSubscriptionPerTicket = getMaxSubscriptionInETHPerTicket();

        Subscription memory s = userToPoolIdToSubscription[user][poolId];

        if(amountOfTickets.mul(maxUserSubscriptionPerTicket) <= s.amountEth) {
            // Means user already participated something and doesn't have enough to add more.
            return 0;
        }

        return amountOfTickets.mul(maxUserSubscriptionPerTicket).sub(s.amountEth);
    }
}
