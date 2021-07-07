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

    struct hPool {
        PoolState poolState;
        uint256 championEthDeposit;
        address championAddress;
        uint256 createdAt;
        uint256 nftTicketId;
        uint256 followersEthDeposit;
        bool isValidated;
        address hPoolAddress;
    }

    // All hPools
    hPool [] hPools;
    // Support listing pools per champion
    mapping (address => uint[]) championAddressToHPoolIds;

    // Instance of oracle
    AggregatorV3Interface linkOracle;


    event PoolInitRequested(uint256 poolId, address champion, uint256 championEthDeposit, uint256 timestamp);

    function initialize () initializer external {
//        setCongressAndMaintainers(_hordCongress, _maintainersRegistry);
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
        hPool memory hp = hPool({
            poolState: PoolState.PENDING_INIT,
            championEthDeposit: msg.value,
            championAddress: msg.sender,
            createdAt: block.timestamp,
            nftTicketId: 0,
            followersEthDeposit: 0,
            isValidated: false,
            hPoolAddress: address(0)
        });

        // Compute ID to match position in array
        uint poolId = hPools.length;
        // Push hPool structure
        hPools.push(hp);
        // Add Id to list of ids for champion
        championAddressToHPoolIds[msg.sender].push(poolId);
        // Trigger event PoolInitRequested
        emit PoolInitRequested(poolId, msg.sender, msg.value, block.timestamp);
    }

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
    }


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
    }


    function setAggregatorInterface(
        address linkOracleAddress
    )
    external
    onlyMaintainer
    {
        require(linkOracleAddress != address(0), "Link oracle address can not be 0x0.");
        linkOracle = AggregatorV3Interface(linkOracleAddress);
    }


    function getMinimalETHToInitPool() public view returns (uint256) {
        uint256 latestPrice = uint256(getLatestETHPrice());
        uint256 usdEThRate = one.mul(one).div(latestPrice);
        return usdEThRate.mul(minUSDToInitPool).div(one);
    }


    /**
     * @notice          Function to fetch the latest token price from ChainLink oracle
     */
    function getLatestETHPrice()
    public
    view
    returns (int)
    {
        (
            uint80 roundID,
            int price,
            uint startedAt,
            uint timeStamp,
            uint80 answeredInRound
        ) = linkOracle.latestRoundData();

        return price;
    }


    /**
     * @notice          Function to fetch on how many decimals is the response
     */
    function getDecimalsReturnPrecision(
        address oracleAddress
    )
    public
    view
    returns (uint8)
    {
        return AggregatorV3Interface(oracleAddress).decimals();
    }

}
