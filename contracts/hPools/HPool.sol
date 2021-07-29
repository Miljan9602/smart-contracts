pragma solidity 0.6.12;

import "../system/HordUpgradable.sol";
import "../interfaces/IHPoolManager.sol";
import "./HPoolToken.sol";

/**
 * HPool contract.
 * @author Nikola Madjarevic
 * Date created: 20.7.21.
 * Github: madjarevicn
 */
contract HPool is HordMiddleware, HPoolToken {

    IHPoolManager public hPoolManager;

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

}
