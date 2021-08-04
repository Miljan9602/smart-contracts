pragma solidity 0.6.12;

import "./system/HordUpgradable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
/**
 * HordTreasury contract.
 * @author David Lee
 * Date created: 18.5.21.
 * Github: 0xKey
 */
contract HordTreasury is HordUpgradable, ReentrancyGuardUpgradeable {

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Total ETH received
    uint256 public totalETHReceived;
    // Total ETH withdrawn from the contract
    uint256 public totalETHWithdrawn;
    // Total tokens received
    mapping (address => uint256) public totalTokenReceived;
    // Total tokens withdrawn
    mapping (address => uint256) public totalTokenWithdrawn;


    event DepositEther(address indexed depositor, uint256 amount);
    event WithdrawEther(address indexed beneficiary, uint256 amount);
    event DepositToken(address indexed depositor, address indexed token, uint256 amount);
    event WithdrawToken(address indexed beneficiary, address indexed token, uint256 amount);

    receive() external payable {
        totalETHReceived = totalETHReceived.add(msg.value);
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
    function depositToken(IERC20 token, uint256 amount) external {
        token.safeTransferFrom(msg.sender, address(this), amount);
        totalTokenReceived[address(token)] = totalTokenReceived[address(token)].add(amount);
        emit DepositToken(msg.sender, address(token), amount);
    }

    /**
     @notice Withdraw ERC20 token
     @param beneficiary is the receiver address
     @param token is the token address to be withdrew
     @param amount is the token amount to be withdrew
     */
    function withdrawToken(address beneficiary, IERC20 token, uint256 amount) external onlyHordCongress nonReentrant {
        require(beneficiary != address(this), "HordTreasury: Can not withdraw to HordTreasury contract");
        require(token.balanceOf(address(this)) >= amount, "HordTreasury: Insufficient balance");
        token.safeTransfer(beneficiary, amount);
        totalTokenWithdrawn[address(token)] = totalTokenWithdrawn[address(token)].add(amount);
        emit WithdrawToken(beneficiary, address(token), amount);
    }

    /**
     @notice Withdraw Ether
     @param beneficiary is the receiver address
     @param amount is Ether amount to be withdrew
     */
    function withdrawEther(address beneficiary, uint256 amount) external onlyHordCongress nonReentrant {
        require(beneficiary != address(this), "HordTreasury: Can not withdraw to HordTreasury contract");
        (bool success,) = payable(beneficiary).call{ value: amount }("");
        require(success, "HordTreasury: Failed to send Ether");
        totalETHWithdrawn = totalETHWithdrawn.add(amount);
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
