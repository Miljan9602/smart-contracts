pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import "../system/HordUpgradable.sol";
import "../interfaces/IHPoolManager.sol";
import "./HPoolToken.sol";
import "../libraries/SafeMath.sol";
import "../SignatureValidator.sol";


/**
 * HPool contract.
 * @author Nikola Madjarevic
 * Date created: 20.7.21.
 * Github: madjarevicn
 */
contract HPool is HordUpgradable, HPoolToken, SignatureValidator {

    //TODO: Compute initial worth of the pool at the launch time
    //TODO: Compute gains with the ratio
    using SafeMath for uint256;

    enum TradeType {
        BUY_ORDER_RATIO,
        BUY_LIMIT,
        SELL_LIMIT,
        MARKET_BUY,
        MARKET_SELL,
        STOP_LOSS
    }

    IHPoolManager public hPoolManager;
    IUniswapV2Router01 private uniswapRouter = IUniswapV2Router01(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    SignatureValidator private signatureValidator;

    address public championAddress;
    uint256 public totalBaseAssetAtLaunch;
    uint256 public hPoolId;
    bool public isHPoolTokenMinted;

    // Mapping that represent is user calim his hPoolTokens
    mapping(address => bool) public didUserClaimHPoolTokens;
    // Mapping which hold current state of assets amount
    mapping(address => uint256) public assetsAmount;
    // Mapping which hold current state of ratio for exact assets
    mapping(address => uint256) public assetsRatio;

    address[] public assets;

    event FollowersBudgetDeposit(uint256 amount);
    event ChampionBudgetDeposit(uint256 amount);
    event HPoolTokenMinted(string name, string symbol, uint256 totalSupply);
    event ClaimedHPoolTokens(address beneficiary, uint256 numberOfClaimedTokens);
    event TradeExecuted(uint256 amountSource, uint256 amountTarget, address sourceToken, address targetToken);


    modifier onlyHPoolManager {
        require(msg.sender == address(hPoolManager), "Restricted only to HPoolManager.");
        _;
    }


    constructor(
        uint256 _hPoolId,
        address _hordCongress,
        address _hordMaintainersRegistry,
        address _hordPoolManager,
        address _championAddress
    )
    public
    {
        setCongressAndMaintainers(_hordCongress, _hordMaintainersRegistry);
        hPoolId = _hPoolId;
        hPoolManager = IHPoolManager(_hordPoolManager);
        championAddress = _championAddress;
    }

    function setChampionAddress(address _championAddress)
    external
    onlyHPoolManager
    {
        championAddress = _championAddress;
    }

    /**
     * @notice  Function allowing congress to pause the smart-contract
     * @dev     Can be only called by HordCongress
     */
    function pause()
    public
    onlyMaintainer
    {
        _pause();
    }

    /**
     * @notice  Function allowing congress to unpause the smart-contract
     * @dev     Can be only called by HordCongress
     */
    function unpause()
    public
    onlyMaintainer
    {
        _unpause();
    }

    function depositBudgetFollowers()
    external
    onlyHPoolManager
    payable
    {
        totalBaseAssetAtLaunch = totalBaseAssetAtLaunch.add(msg.value);
        emit FollowersBudgetDeposit(msg.value);
    }

    function depositBudgetChampion()
    external
    onlyHPoolManager
    payable
    {
        totalBaseAssetAtLaunch = totalBaseAssetAtLaunch.add(msg.value);
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

    function claimHPoolTokens()
    external
    whenNotPaused
    {
        require(!didUserClaimHPoolTokens[msg.sender], "Follower already withdraw tokens.");

        uint256 numberOfTokensToClaim = getNumberOfTokensUserCanClaim(msg.sender);
        _transfer(address(this), msg.sender, numberOfTokensToClaim);

        didUserClaimHPoolTokens[msg.sender] = true;

        emit ClaimedHPoolTokens(msg.sender, numberOfTokensToClaim);
    }

    function verifyAndExecuteBuyOrderRatio(
        address dstToken,
        bytes32 sigR,
        bytes32 sigS,
        uint256 ratio,
        uint256 amountSrc,
        uint256 minAmountOut,
        uint8 sigV
    )
    external
    onlyMaintainer
    {
        BuyOrderRatio memory buyOrderRatio;
        buyOrderRatio.dstToken = dstToken;
        buyOrderRatio.ratio = ratio;

        address signer = signatureValidator.recoverSignatureBuyOrderRatio(buyOrderRatio, sigR, sigS, sigV);
        require(signer == championAddress, "Invalid signer address.");

        uint256 actualAmountPerRatio = ratio.mul(totalBaseAssetAtLaunch);
        require(amountSrc == actualAmountPerRatio);

        swapExactEthForTokens(dstToken, amountSrc, minAmountOut);
    }

    function verifyAndExecuteBuyOrderExactAmount(
        address dstToken,
        bytes32 sigR,
        bytes32 sigS,
        uint256 amountSrc,
        uint256 minAmountOut,
        uint8 sigV
    )
    external
    onlyMaintainer
    {
        address[] memory path = new address[](2);
        path[0] = uniswapRouter.WETH();
        path[1] = dstToken;

        TradeOrder memory tradeOrder;
        tradeOrder.srcToken = path[0];
        tradeOrder.dstToken = path[1];
        tradeOrder.amountSrc = amountSrc;

        address signer = signatureValidator.recoverSignatureTradeOrder(tradeOrder, sigR, sigS, sigV);
        require(signer == championAddress, "Invalid signer address.");

        swapExactEthForTokens(dstToken, amountSrc, minAmountOut);
    }

    /*
        1. on pool creation - champion is signing target token and ratio, so maintainer should send target token and ratio in the params and contracts should verify it
        2. on pool edit post launch - champion will sign for buy orders the target token and the ETH amount, so these should be sent + verified by the contract
        3. amount out min is optional, and if maintainer sends it, contracts can verify.
    */

    function swapExactEthForTokens(
        address token,
        uint256 amountSrc,
        uint256 minAmountOut
    )
    private
    {
        address[] memory path = new address[](2);
        path[0] = uniswapRouter.WETH();
        path[1] = token;

        uint256 deadline = block.timestamp.add(60);
        uint256[] memory actualAmountOutMin = uniswapRouter.getAmountsOut(amountSrc, path);
        require(actualAmountOutMin[1] >= minAmountOut);

        uint256[] memory amounts = uniswapRouter.swapExactETHForTokens(
            actualAmountOutMin[1],
            path,
            address(this),
            deadline
        );

        assetsAmount[path[0]] = assetsAmount[path[0]].sub(amounts[0]);
        assetsAmount[token] = assetsAmount[token].add(amounts[1]);

        emit TradeExecuted(amounts[0], amounts[1], path[0], path[1]);
    }

    function swapExactTokensForEth(
        address token,
        uint256 amountOutMin,
        uint256 deadline
    )
    external
    payable
    onlyMaintainer
    {
        require(msg.value > 0, "Token amount is less than minimal amount.");
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = uniswapRouter.WETH();

        uint256[] memory amounts = uniswapRouter.swapExactTokensForETH(
            msg.value,
            amountOutMin,
            path,
            msg.sender,
            deadline
        );

        assetsAmount[token] = assetsAmount[token].sub(amounts[0]);
        assetsAmount[path[1]] = assetsAmount[path[1]].add(amounts[1]);
    }

    function swapExactTokensForTokens(
        address tokenA,
        address tokenB,
        uint256 amountOutMin,
        uint256 deadline
    )
    external
    payable
    onlyMaintainer
    {
        require(msg.value > 0, "Token amount is less than minimal amount.");
        address[] memory path = new address[](3);

        path[0] = tokenA;
        path[1] = uniswapRouter.WETH();
        path[2] = tokenB;

        uint256[] memory amounts = uniswapRouter.swapExactTokensForTokens(
            msg.value,
            amountOutMin,
            path,
            msg.sender,
            deadline
        );

        assetsAmount[tokenA] = assetsAmount[tokenA].sub(amounts[0]);
        assetsAmount[tokenB] = assetsAmount[tokenB].add(amounts[2]);
    }


    function getNumberOfTokensUserCanClaim(address follower)
    public
    view
    returns (uint256)
    {

        if(didUserClaimHPoolTokens[follower]) {
            return 0;
        }

        (uint256 subscriptionETHUser, ) = hPoolManager.getUserSubscriptionForPool(hPoolId, follower);
        (, , , , , , uint256 totalFollowerDeposit, , ) = hPoolManager.getPoolInfo(hPoolId);

        uint256 tokensForClaiming = subscriptionETHUser.mul(totalSupply()).div(totalFollowerDeposit);
        return tokensForClaiming;
    }


    //TODO: Based on assumption that number of assets inside HPool won't be more than X, so everything fits inside 1 tx
    function liquidatePositionAndPullAssets()
    public
    {

        // Compute how much HPool tokens user hold or has an option to claim
        uint256 hPoolTokensAmount = balanceOf(msg.sender) != 0 ? balanceOf(msg.sender) : getNumberOfTokensUserCanClaim(msg.sender);

        if(hPoolTokensAmount == 0) {
            revert("User does not have any HPool tokens.");
        }

        // Compute share against all other hPool token holders
        uint256 share = hPoolTokensAmount.mul(10**18).div(totalSupply());

        /**
         * total supply = minted - burned
         * An example:
         *  total suypply = 1000 tokens
         * hPoolTokensAmount I have = 37
         ==> share = 0,037
         */

        // Iterate through all assets and transfer them to user 1 by 1
        for(uint256 i = 0; i < assets.length; i++) {
            // Instantiate asset
            IERC20 asset = IERC20(assets[i]);

            // Compute balance of this asset inside HPool contract
            uint256 balanceOfAsset = asset.balanceOf(address(this));

            // Transfer asset to user
            asset.transfer(msg.sender, balanceOfAsset.mul(share).div(10**18));
        }

        if(balanceOf(msg.sender) != 0) {
            // Burn users HPool Tokens
            _burn(msg.sender, hPoolTokensAmount);
        } else {
            // Burn non-claimed HPool tokens by user
            _burn(address(this), hPoolTokensAmount);
            didUserClaimHPoolTokens[msg.sender] = true;
        }

    }


}
