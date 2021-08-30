pragma solidity 0.6.12;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import "../system/HordUpgradable.sol";
import "../interfaces/IHPoolManager.sol";
import "./HPoolToken.sol";
import "../libraries/SafeMath.sol";

/**
 * HPool contract.
 * @author Nikola Madjarevic
 * Date created: 20.7.21.
 * Github: madjarevicn
 */
contract HPool is HordUpgradable, HPoolToken {

    using SafeMath for uint256;

    IHPoolManager public hPoolManager;
    IUniswapV2Router01 public uniswapRouter;

    //TODO: Add HPOOL ID
    bool public isHPoolTokenMinted;
    mapping(address => bool) public didUserClaimHPoolTokens;

    event FollowersBudgetDeposit(uint256 amount);
    event ChampionBudgetDeposit(uint256 amount);
    event HPoolTokenMinted(string name, string symbol, uint256 totalSupply);
    //TODO: Add event ClaimedHPoolTokens

    modifier onlyHPoolManager {
        //TODO: Add error message
        require(msg.sender == address(hPoolManager));
        _;
    }

    constructor(
        address _hordCongress,
        address _hordMaintainersRegistry,
        address _hordPoolManager
    )
    public
    {
        setCongressAndMaintainers(_hordCongress, _hordMaintainersRegistry);
        hPoolManager = IHPoolManager(_hordPoolManager);
        //TODO: Set through constructor arguments
        uniswapRouter = IUniswapV2Router01(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    }

    function depositBudgetFollowers()
    external
    onlyHPoolManager
    payable
    {
        emit FollowersBudgetDeposit(msg.value);
    }

    function depositBudgetChampion()
    external
    onlyHPoolManager
    payable
    {
        emit ChampionBudgetDeposit(msg.value);
    }

    function mintHPoolToken(
        string memory name,
        string memory symbol,
        uint256 _totalSupply
    )
    external
    onlyHPoolManager
    {
        require(!isHPoolTokenMinted, "HPoolToken can be minted only once.");
        // Mark that token is minted.
        isHPoolTokenMinted = true;
        // Initially all HPool tokens are minted on the pool level
        createToken(name, symbol, _totalSupply, address(this));
        // Trigger even that hPool token is minted
        emit HPoolTokenMinted(name, symbol, _totalSupply);
    }

    // TODO: rename to `claimHPoolTokens`
    function withdrawHPoolTokens()
    public
    {
        //TODO: Get from HPoolManager totalFollowersDeposit
        //TODO: Get from HPoolManager Subscription for user
        //TODO: Apply formula: subscriptionEThUser/ totalFollowerDeposit * totalSupply
        require(msg.sender != address(this), "Can not withdraw to HPoolContract contract");
        require(!didUserClaimHPoolTokens[msg.sender], "Follower already withdraw tokens.");

        didUserClaimHPoolTokens[msg.sender] = true;

        //TODO: Call _transfer, think about params
        transfer(msg.sender, getNumberOfTokensForClaiming(msg.sender));
    }

    function getNumberOfTokensUserCanClaim(address follower)
    public
    returns (uint256)
    {
        //TODO: If user claimed, should return 0

        uint256 tokensForClaiming = balanceOf(follower).div(totalDeposit).mul(totalSupply());
        return tokensForClaiming;
    }

    function swapExactTokensForEth(
        address token,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 deadline
    )
    external
    {
        require(msg.sender.balance >= amountIn);
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = uniswapRouter.WETH();

        uniswapRouter.swapExactTokensForETH(
            amountIn,
            amountOutMin,
            path,
            msg.sender,
            deadline
        );
    }

    function swapExactEthForTokens(
        address token,
        uint256 amountOutMin,
        uint256 deadline
    )
    external
    payable
    {
        require(msg.value > 0, "ETH amount is less than minimum amount.");
        address[] memory path = new address[](2);
        path[0] = uniswapRouter.WETH();
        path[1] = token;

        uniswapRouter.swapExactETHForTokens(
            amountOutMin,
            path,
            msg.sender,
            deadline
        );
    }

    function swapExactTokensForTokens(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 deadline
    )
    external
    {
        require(msg.sender.balance >= amountIn);
        address[] memory path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;

        uniswapRouter.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            msg.sender,
            deadline
        );
    }
}
