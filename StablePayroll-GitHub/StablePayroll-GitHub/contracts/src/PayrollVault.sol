// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title PayrollVault
/// @notice Holds USDC on Arc and releases recurring payroll tranches to recipients.
///         Each recipient is tagged with an off-chain fiat destination (bank + currency),
///         which the payout orchestrator (server/payrollCycle.js) resolves via Blockradar
///         after the onchain release below completes.
contract PayrollVault {
    address public admin;
    IERC20 public immutable usdc;

    struct Recipient {
        address wallet;        // Circle Developer-Controlled Wallet address receiving USDC onchain
        uint256 monthlyAmount; // in USDC base units (6 decimals)
        string  fiatCurrency;  // e.g. "NGN"
        string  bankAccountRef;// opaque reference resolved by the offchain payout service
        bool    active;
    }

    mapping(uint256 => Recipient) public recipients;
    uint256 public recipientCount;

    // recipientId => last release timestamp
    mapping(uint256 => uint256) public lastReleasedAt;

    uint256 public constant RELEASE_INTERVAL = 30 days;

    event RecipientAdded(uint256 indexed id, address wallet, uint256 monthlyAmount, string fiatCurrency);
    event RecipientUpdated(uint256 indexed id, uint256 monthlyAmount, bool active);
    event TrancheReleased(uint256 indexed id, address indexed wallet, uint256 amount, uint256 timestamp);
    event Funded(address indexed from, uint256 amount);
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == admin, "PayrollVault: not admin");
        _;
    }

    constructor(address _usdc) {
        require(_usdc != address(0), "PayrollVault: zero usdc address");
        admin = msg.sender;
        usdc = IERC20(_usdc);
    }

    /// @notice Pull USDC into the vault. Caller must have approved this contract first.
    function fund(uint256 amount) external {
        require(usdc.transferFrom(msg.sender, address(this), amount), "PayrollVault: fund transfer failed");
        emit Funded(msg.sender, amount);
    }

    function addRecipient(
        address wallet,
        uint256 monthlyAmount,
        string calldata fiatCurrency,
        string calldata bankAccountRef
    ) external onlyAdmin returns (uint256 id) {
        require(wallet != address(0), "PayrollVault: zero recipient wallet");
        require(monthlyAmount > 0, "PayrollVault: zero amount");

        id = recipientCount++;
        recipients[id] = Recipient({
            wallet: wallet,
            monthlyAmount: monthlyAmount,
            fiatCurrency: fiatCurrency,
            bankAccountRef: bankAccountRef,
            active: true
        });

        emit RecipientAdded(id, wallet, monthlyAmount, fiatCurrency);
    }

    function updateRecipient(uint256 id, uint256 monthlyAmount, bool active) external onlyAdmin {
        require(id < recipientCount, "PayrollVault: unknown recipient");
        Recipient storage r = recipients[id];
        r.monthlyAmount = monthlyAmount;
        r.active = active;
        emit RecipientUpdated(id, monthlyAmount, active);
    }

    /// @notice Releases one monthly tranche to a recipient's onchain wallet.
    ///         Enforces a 30-day cooldown so payroll cannot be double-run by mistake.
    function releaseTranche(uint256 id) external onlyAdmin {
        require(id < recipientCount, "PayrollVault: unknown recipient");
        Recipient memory r = recipients[id];
        require(r.active, "PayrollVault: recipient inactive");
        require(
            block.timestamp >= lastReleasedAt[id] + RELEASE_INTERVAL || lastReleasedAt[id] == 0,
            "PayrollVault: interval not elapsed"
        );
        require(usdc.balanceOf(address(this)) >= r.monthlyAmount, "PayrollVault: insufficient vault balance");

        lastReleasedAt[id] = block.timestamp;
        require(usdc.transfer(r.wallet, r.monthlyAmount), "PayrollVault: release transfer failed");

        emit TrancheReleased(id, r.wallet, r.monthlyAmount, block.timestamp);
    }

    /// @notice Demo/testnet convenience: bypasses the 30-day cooldown. Remove before any production use.
    function releaseTrancheNow(uint256 id) external onlyAdmin {
        require(id < recipientCount, "PayrollVault: unknown recipient");
        Recipient memory r = recipients[id];
        require(r.active, "PayrollVault: recipient inactive");
        require(usdc.balanceOf(address(this)) >= r.monthlyAmount, "PayrollVault: insufficient vault balance");

        lastReleasedAt[id] = block.timestamp;
        require(usdc.transfer(r.wallet, r.monthlyAmount), "PayrollVault: release transfer failed");

        emit TrancheReleased(id, r.wallet, r.monthlyAmount, block.timestamp);
    }

    function vaultBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function setAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "PayrollVault: zero admin");
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }
}
