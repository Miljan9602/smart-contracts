pragma solidity 0.6.12;

import "../system/HordMiddleware.sol";
import "../interfaces/IHPoolManager.sol";

/**
 * HPool contract.
 * @author Nikola Madjarevic
 * Date created: 20.7.21.
 * Github: madjarevicn
 */
contract HPool is HordMiddleware {

    IHPoolManager public hPoolManager;

    event FollowersBudgetDeposit(uint256 amount);
    event ChampionBudgetDeposit(uint256 amount);

    modifier onlyHPoolManager {
        require(msg.sender == address(hPoolManager));
        _;
    }

    constructor(
        address _hordCongress,
        address _hordMaintainersRegistry
    )
    public
    {
        setCongressAndMaintainers(_hordCongress, _hordMaintainersRegistry);
        hPoolManager = IHPoolManager(msg.sender);
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
}
