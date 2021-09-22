pragma solidity 0.6.12;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import "../system/HordUpgradable.sol";
import "../interfaces/IHPoolManager.sol";
import "./HPoolToken.sol";


/**
 * HPool contract.
 * @author Nikola Madjarevic
 * Date created: 20.7.21.
 * Github: madjarevicn
 */
contract HPool is HordUpgradable, HPoolToken {

    IHPoolManager public hPoolManager;
    IUniswapV2Router01 public uniswapRouter;

    bool public isHPoolTokenMinted;

    event FollowersBudgetDeposit(uint256 amount);
    event ChampionBudgetDeposit(uint256 amount);
    event HPoolTokenMinted(string name, string symbol, uint256 totalSupply);

    modifier onlyHPoolManager {
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
        string memory name, //TODO take from backend : "Hord.app Pool Token - <Champion Name> - Gen <Nonce>" (e.g. Hord.app Pool Token - TheMoonWalker - Gen1)
        string memory symbol, //TODO take from backend : HPOOL-<HPOOLID>
        uint256 _totalSupply  //TODO take from configs
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

    //TODO: work in sigs
    function swapExactTokensForEth(
        address token,
        uint amountIn,
        uint amountOutMin,
        uint deadline
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

    //TODO: workin sigs
    function swapExactEthForTokens(
        address token,
        uint amountOutMin,
        uint deadline
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

    //TODO workin sigs
    function swapExactTokensForTokens(
        address tokenA,
        address tokenB,
        uint amountIn,
        uint amountOutMin,
        uint deadline
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
