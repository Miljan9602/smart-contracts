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

    IHPoolManager public hPoolManager;
    IUniswapV2Router01 private uniswapRouter = IUniswapV2Router01(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    SignatureValidator private signatureValidator;

    uint256 public hPoolId;
    bool public isHPoolTokenMinted;
    // Mapping that represent is user calim his hPoolTokens
    mapping(address => bool) public didUserClaimHPoolTokens;
    // Mapping which hold current state of assets amount
    mapping(address => uint256) public assetsAmount;

    address[] public assets;

    event FollowersBudgetDeposit(uint256 amount);
    event ChampionBudgetDeposit(uint256 amount);
    event HPoolTokenMinted(string name, string symbol, uint256 totalSupply);
    event ClaimedHPoolTokens(address beneficiary, uint256 numberOfClaimedTokens);


    modifier onlyHPoolManager {
        require(msg.sender == address(hPoolManager), "Restricted only to HPoolManager.");
        _;
    }

    constructor(
        uint256 _hPoolId,
        address _hordCongress,
        address _hordMaintainersRegistry,
        address _hordPoolManager
    )
    public
    {
        setCongressAndMaintainers(_hordCongress, _hordMaintainersRegistry);
        hPoolId = _hPoolId;
        hPoolManager = IHPoolManager(_hordPoolManager);
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

    function swapExactEthForTokens(
        address token,
        bytes32 sigR,
        bytes32 sigS,
        uint256 amountOutMin,
        uint256 deadline,
        uint8 sigV
    )
    external
    payable
    onlyMaintainer
    {
        require(msg.value > 0, "ETH amount is less than minimal amount.");
        address[] memory path = new address[](2);
        path[0] = uniswapRouter.WETH();
        path[1] = token;

        TradeOrder memory tradeOrder;
        tradeOrder.srcToken = path[0];
        tradeOrder.dstToken = path[1];
        tradeOrder.amountSrc = msg.value;

        address publicAddress = signatureValidator.recoverSignatureTradeOrder(tradeOrder, sigR, sigS, sigV);

        uint256[] memory amounts = uniswapRouter.swapExactETHForTokens(
            amountOutMin,
            path,
            publicAddress,
            deadline
        );

        assetsAmount[path[0]] = assetsAmount[path[0]].sub(amounts[0]);
        assetsAmount[token] = assetsAmount[token].add(amounts[1]);
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
