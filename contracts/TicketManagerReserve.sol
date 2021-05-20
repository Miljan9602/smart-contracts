pragma solidity ^0.6.12;

import "./interfaces/IERC20.sol";
import "./system/HordUpgradable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/**
 * TicketManagerReserve contract.
 * @author David Lee
 * Date created: 18.5.21.
 * Github: 0xKey
 */
contract TicketManagerReserve is HordUpgradable, ReentrancyGuardUpgradeable {
    event DepositEther(address indexed depositor, uint256 amount);
    event WithdrawEther(address indexed beneficiary, uint256 amount);
    event DepositToken(address indexed depositor, address indexed token, uint256 amount);
    event WithdrawToken(address indexed beneficiary, address indexed token, uint256 amount);

    receive() external payable {
        emit DepositEther(msg.sender, msg.value);
    }

    function initialize(address _hordCongress, address _maintainersRegistry) public initializer {
        __ReentrancyGuard_init();

        // Set hord congress and maintainers registry contract
        setCongressAndMaintainers(_hordCongress, _maintainersRegistry);
    }

    /**
     @notice Deposit ERC20 token
     @param token is the token address to be deposited
     @param amount is the token amount to be deposited
     */
    function depositToken(address token, uint256 amount) external {
        require(amount <= IERC20(token).allowance(msg.sender, address(this)));
        require(IERC20(token).transferFrom(msg.sender, address(this), amount));
        emit DepositToken(msg.sender, token, amount);
    }

    /**
     @notice Withdraw ERC20 token
     @param beneficiary is the receiver address
     @param token is the token address to be withdrew
     @param amount is the token amount to be withdrew
     */
    function withdrawToken(address beneficiary, address token, uint256 amount) external onlyHordCongress nonReentrant {
        require(beneficiary != address(this), "TicketManagerReserve: Can not withdraw to TicketManagerReserve contract");
        require(IERC20(token).balanceOf(address(this)) >= amount, "TicketManagerReserve: Insufficient balance");
        require(IERC20(token).transfer(beneficiary, amount));
        emit WithdrawToken(beneficiary, token, amount);
    }

    /**
     @notice Withdraw Ether
     @param beneficiary is the receiver address
     @param amount is Ether amount to be withdrew
     */
    function withdrawEther(address beneficiary, uint256 amount) external onlyHordCongress nonReentrant {
        require(beneficiary != address(this), "TicketManagerReserve: Can not withdraw to TicketManagerReserve contract");
        (bool success,) = payable(beneficiary).call{ value: amount }("");
        require(success, "TicketManagerReserve: Failed to send Ether");
        emit WithdrawEther(beneficiary, amount);
    }

    /**
     @notice Get Ether balance
     */
    function getEtherBalance() external view returns(uint256) {
        return address(this).balance;
    }

    /**
     @notice Get the token balance
     @param token is the token address to get the balance
     */
    function getTokenBalance(address token) external view returns(uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
