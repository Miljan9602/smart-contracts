//"SPDX-License-Identifier: UNLICENSED"
pragma solidity 0.6.12;

import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import "../interfaces/AggregatorV3Interface.sol";
import "../interfaces/IHordTicketFactory.sol";
import "../interfaces/IHordTreasury.sol";
import "../interfaces/IHPoolFactory.sol";
import "../interfaces/IHPool.sol";
import "../system/HordUpgradable.sol";
import "../libraries/SafeMath.sol";


/**
 * HPoolManager contract.
 * @author Nikola Madjarevic
 * Date created: 7.7.21.
 * Github: madjarevicn
 */
contract HPoolManager is PausableUpgradeable, HordUpgradable {

    using SafeMath for *;

    // States of the pool contract
    enum PoolState{
        PENDING_INIT,
        TICKET_SALE,
        PRIVATE_SUBSCRIPTION,
        PUBLIC_SUBSCRIPTION,
        ASSET_STATE_TRANSITION_IN_PROGRESS,
        ACTIVE,
        FINISHING,
        ENDED
    }

    enum SubscriptionRound {
        PRIVATE,
        PUBLIC
    }

    // Address for HORD token
    address public hordToken;
    // Fee charged for the maintainers work
    uint256 public serviceFeePercent;
    // Minimal subscription which should be collected in order to launch HPool.
    uint256 public minimalSubscriptionToLaunchPool;
    // Minimal amount of USD to initialize pool (for champions)
    uint256 public minUSDToInitPool;
    // Maximal USD allocation per Ticket
    uint256 public maxUSDAllocationPerTicket;
    //Public round subscription FEE %
    uint256 public publicRoundSubscriptionFeePercent;
    // Constant, representing 1ETH in WEI units.
    uint256 public constant one = 10e18;
    // Precision for percent unit
    uint256 public constant serviceFeePrecision = 10e6;

    // Subscription struct, represents subscription of user
    struct Subscription {
        address user;
        uint256 amountEth;
        uint256 numberOfTickets;
        SubscriptionRound sr;
    }

    // HPool struct
    struct hPool {
        PoolState poolState;
        uint256 championEthDeposit;
        address championAddress;
        uint256 createdAt;
        uint256 nftTicketId;
        bool isValidated;
        uint256 followersEthDeposit;
        address hPoolContractAddress;
        uint256 treasuryFeePaid;
    }

    // Instance of oracle
    AggregatorV3Interface linkOracle;
    // Instance of hord ticket factory
    IHordTicketFactory hordTicketFactory;
    // Instance of Hord treasury contract
    IHordTreasury hordTreasury;
    // Instance of HPool Factory contract
    IHPoolFactory hPoolFactory;

    // All hPools
    hPool [] public hPools;
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
    event TicketIdSetForPool(uint256 poolId, uint256 nftTicketId);
    event HPoolStateChanged(uint256 poolId, PoolState newState);
    event MinimalUSDToInitPoolSet(uint256 newMinimalAmountToInitPool);
    event MaximalUSDAllocationPerTicket(uint256 newMaximalAllocationPerTicket);
    event Subscribed(uint256 poolId, address user, uint256 amountETH, uint256 numberOfTickets, SubscriptionRound sr);
    event TicketsWithdrawn(uint256 poolId, address user, uint256 numberOfTickets);
    event ServiceFeePaid(uint256 poolId, uint256 amount);

    /**
     * @notice          Initializer function, can be called only once, replacing constructor
     * @param           _hordCongress is the address of HordCongress contract
     * @param           _maintainersRegistry is the address of the MaintainersRegistry contract
     */
    function initialize (
        address _hordCongress,
        address _maintainersRegistry,
        address _hordTicketFactory,
        address _hordTreasury,
        address _hordToken,
        address _hPoolFactory,
        address _chainlinkOracle
    )
    initializer
    external
    {
        require(_hordCongress != address(0));
        require(_maintainersRegistry != address(0));
        require(_hordTicketFactory != address(0));

        setCongressAndMaintainers(_hordCongress, _maintainersRegistry);
        hordTicketFactory = IHordTicketFactory(_hordTicketFactory);
        hordTreasury = IHordTreasury(_hordTreasury);
        hPoolFactory = IHPoolFactory(_hPoolFactory);
        hordToken = _hordToken;

        linkOracle = AggregatorV3Interface(_chainlinkOracle);
    }

    /**
     * @notice          Internal function to handle safe transferring of ETH.
     */
    function safeTransferETH(address to, uint256 value) internal {
        (bool success,) = to.call{value:value}(new bytes(0));
        require(success, 'TransferHelper: ETH_TRANSFER_FAILED');
    }


    /**
     * @notice          Internal function to pay service to hord treasury contract
     */
    function payServiceFeeToTreasury(uint256 poolId, uint256 amount) internal {
        safeTransferETH(address(hordTreasury), amount);
        emit ServiceFeePaid(poolId, amount);
    }

    /**
     * @notice          Function to set minimal usd required for initializing pool
     * @param           _minUSDToInitPool represents minimal amount of USD which is required to init pool, in WEI
     */
    function setMinimalUSDToInitPool(
        uint256 _minUSDToInitPool
    )
    external
    onlyHordCongress
    {
        require(_minUSDToInitPool > 0);
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
    onlyHordCongress
    {
        require(_maxUSDAllocationPerTicket > 0);
        maxUSDAllocationPerTicket = _maxUSDAllocationPerTicket;

        emit MaximalUSDAllocationPerTicket(maxUSDAllocationPerTicket);
    }

    /**
     * @notice          Function to set service (gas) fee and precision
     */
    function setServiceFeePercentAndPrecision(
        uint256 _serviceFeePercent
    )
    external
    onlyHordCongress
    {
        serviceFeePercent = _serviceFeePercent;
    }

    /**
     * @notice          Function where champion can create his pool.
     *                  In case champion is not approved, maintainer can cancel his pool creation,
     *                  and return him back the funds.
     */
    function createHPool() //TODO: add param be_pool_id
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
        uint256 poolId = hPools.length;
        // Push hPool structure
        hPools.push(hp);

        // Add Id to list of ids for champion
        championAddressToHPoolIds[msg.sender].push(poolId);

        // Trigger events
        emit PoolInitRequested(poolId, msg.sender, msg.value, block.timestamp); //TODO add to emit the be_hpool_id
        emit HPoolStateChanged(poolId, hp.poolState);
    }


    /**
     * @notice          Function to set NFT for pool, which will at the same time validate the pool itself.
     * @param           poolId is the ID of the pool contract.
     */
    function setNftForPool(
        uint256 poolId,
        uint256 _nftTicketId
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
     * @notice          Function to start private subscription phase. Can be started only if previous
     *                  state of the hPool was TICKET_SALE.
     * @param           poolId is the ID of the pool contract.
     */
    function startPrivateSubscriptionPhase(
        uint256 poolId
    )
    external
    onlyMaintainer
    {
        require(poolId < hPools.length, "hPool with poolId does not exist.");

        hPool storage hp = hPools[poolId];

        require(hp.poolState == PoolState.TICKET_SALE);
        hp.poolState = PoolState.PRIVATE_SUBSCRIPTION;

        emit HPoolStateChanged(poolId, hp.poolState);
    }


    /**
     * @notice          Function for users to subscribe for the hPool.
     */
    function privateSubscribeForHPool(
        uint256 poolId
    )
    external
    payable
    {
        hPool storage hp = hPools[poolId];
        require(hp.poolState == PoolState.PRIVATE_SUBSCRIPTION, "hPool is not in PRIVATE_SUBSCRIPTION state.");

        Subscription memory s = userToPoolIdToSubscription[msg.sender][poolId];
        require(s.amountEth == 0, "User can not subscribe more than once.");


        uint256 numberOfTicketsToUse = getRequiredNumberOfTicketsToUse(msg.value);
        require(numberOfTicketsToUse > 0);

        hordTicketFactory.safeTransferFrom(
            msg.sender,
            address(this),
            hp.nftTicketId,
            numberOfTicketsToUse,
            "0x0"
        );

        s.amountEth = msg.value;
        s.numberOfTickets = numberOfTicketsToUse;
        s.user = msg.sender;
        s.sr = SubscriptionRound.PRIVATE;

        // Store subscription
        poolIdToSubscriptions[poolId].push(s);
        userToPoolIdToSubscription[msg.sender][poolId] = s;

        emit Subscribed(poolId, msg.sender, msg.value, numberOfTicketsToUse, s.sr);
    }

    function startPublicSubscriptionPhase(
        uint256 poolId
    )
    public
    onlyMaintainer
    {
        require(poolId < hPools.length, "hPool with poolId does not exist.");

        hPool storage hp = hPools[poolId];

        require(hp.poolState == PoolState.PRIVATE_SUBSCRIPTION);
        hp.poolState = PoolState.PUBLIC_SUBSCRIPTION;

        emit HPoolStateChanged(poolId, hp.poolState);
    }

    /**
     * @notice          Function for users to subscribe for the hPool.
     */
    function publicSubscribeForHPool(
        uint256 poolId
    )
    external
    payable
    {
        hPool storage hp = hPools[poolId];
        require(hp.poolState == PoolState.PRIVATE_SUBSCRIPTION, "hPool is not in PUBLIC_SUBSCRIPTION state.");

        Subscription memory s = userToPoolIdToSubscription[msg.sender][poolId];
        require(s.amountEth == 0, "User can not subscribe more than once.");

        s.amountEth = msg.value;
        s.numberOfTickets = 0;
        s.user = msg.sender;
        s.sr = SubscriptionRound.PUBLIC;

        // Store subscription
        poolIdToSubscriptions[poolId].push(s);
        userToPoolIdToSubscription[msg.sender][poolId] = s;

        emit Subscribed(poolId, msg.sender, msg.value, 0, s.sr);
    }

    /**
     * @notice          Maintainer should end subscription phase in case all the criteria is reached
     */
    function endSubscriptionPhaseAndInitHPool(
        uint256 poolId
    )
    public
    onlyMaintainer
    {
        hPool storage hp = hPools[poolId];
        require(hp.poolState == PoolState.PUBLIC_SUBSCRIPTION, "hPool is not in subscription state.");
        require(hp.followersEthDeposit >= getMinSubscriptionToLaunchInETH(), "hPool subscription amount is below threshold.");


        hp.poolState = PoolState.ASSET_STATE_TRANSITION_IN_PROGRESS;

        // Deploy the HPool contract
        IHPool hpContract = IHPool(hPoolFactory.deployHPool());

        // Set the deployed address of hPool
        hp.hPoolContractAddress = address(hpContract);

        uint256 treasuryFeeETH = hp.followersEthDeposit.mul(serviceFeePercent).div(serviceFeePrecision);

        payServiceFeeToTreasury(poolId, treasuryFeeETH);

        hpContract.depositBudgetFollowers{value: hp.followersEthDeposit.sub(treasuryFeeETH)}();
        hpContract.depositBudgetChampion{value: hp.championEthDeposit}();

        hp.treasuryFeePaid = treasuryFeeETH;

        // Trigger event that pool state is changed
        emit HPoolStateChanged(poolId, hp.poolState);
    }


    /**
     * @notice          Function to withdraw tickets. It can be called whenever after subscription phase.
     * @param           poolId is the ID of the pool for which user is withdrawing.
     */
    function withdrawTickets(uint256 poolId) public {
        hPool storage hp = hPools[poolId];
        Subscription storage s = userToPoolIdToSubscription[msg.sender][poolId];

        require(s.amountEth > 0, "User did not partcipate in this hPool.");
        require(s.numberOfTickets > 0, "User have already withdrawn his tickets.");
        require(uint256 (hp.poolState) > 3, "Only after Subscription phase user can withdraw tickets.");

        hordTicketFactory.safeTransferFrom(
            address(this),
            msg.sender,
            hp.nftTicketId,
            s.numberOfTickets,
            "0x0"
        );

        // Trigger event that user have withdrawn tickets
        emit TicketsWithdrawn(poolId, msg.sender, s.numberOfTickets);

        // Remove users tickets.
        s.numberOfTickets = 0;
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
     * @notice          Function to get minimal subscription in ETH so pool can launch
     */
    function getMinSubscriptionToLaunchInETH()
    public
    view
    returns (uint256)
    {
        uint256 latestPrice = uint256(getLatestPrice());
        uint256 usdEThRate = one.mul(one).div(latestPrice);
        return usdEThRate.mul(minimalSubscriptionToLaunchPool).div(one);
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

        Subscription memory s = userToPoolIdToSubscription[user][poolId];

        if(s.amountEth > 0) {
            // User already subscribed, can subscribe only once.
            return 0;
        }

        uint256 numberOfTickets = hordTicketFactory.balanceOf(user, hp.nftTicketId);
        uint256 maxUserSubscriptionPerTicket = getMaxSubscriptionInETHPerTicket();

        return numberOfTickets.mul(maxUserSubscriptionPerTicket);
    }


    /**
     * @notice          Function to return required number of tickets for user to use in order to subscribe
     *                  with selected amount
     * @param           subscriptionAmount is the amount of ETH user wants to subscribe with.
     */
    function getRequiredNumberOfTicketsToUse(uint256 subscriptionAmount) public view returns (uint256) {

        uint256 maxParticipationPerTicket = getMaxSubscriptionInETHPerTicket();
        uint256 amountOfTicketsToUse = (subscriptionAmount).div(maxParticipationPerTicket);


        if(subscriptionAmount.mul(maxParticipationPerTicket) < amountOfTicketsToUse) {
            amountOfTicketsToUse++;
        }

        return amountOfTicketsToUse;
    }


    /**
     * @notice          Function to get user subscription for the pool.
     * @param           poolId is the ID of the pool
     * @param           user is the address of user
     * @return          amount of ETH user deposited and number of tickets taken from user.
     */
    function getUserSubscriptionForPool(
        uint256 poolId,
        address user
    )
    external
    view
    returns (uint256, uint256)
    {
        Subscription memory subscription = userToPoolIdToSubscription[user][poolId];

        return (
            subscription.amountEth,
            subscription.numberOfTickets
        );
    }


    /**
     * @notice          Function to get information for specific pool
     * @param           poolId is the ID of the pool
     */
    function getPoolInfo(
        uint256 poolId
    )
    external
    view
    returns (
        uint256, uint256, address, uint256, uint256, bool, uint256, address, uint256
    )
    {
        // Load pool into memory
        hPool memory hp = hPools[poolId];

        return (
            uint256(hp.poolState), hp.championEthDeposit, hp.championAddress, hp.createdAt, hp.nftTicketId,
            hp.isValidated, hp.followersEthDeposit, hp.hPoolContractAddress, hp.treasuryFeePaid
        );
    }

}
