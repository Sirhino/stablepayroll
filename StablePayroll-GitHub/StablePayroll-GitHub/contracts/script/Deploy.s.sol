// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PayrollVault.sol";

/// @notice Deploys PayrollVault to Arc Testnet, wired to the native USDC token.
/// Usage (Git Bash, one command, private key via encrypted keystore — never inline):
///   forge script script/Deploy.s.sol:Deploy --rpc-url $ARC_TESTNET_RPC_URL --account deployer --broadcast --legacy
contract Deploy is Script {
    // Arc Testnet native USDC (6 decimals)
    address constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    function run() external {
        vm.startBroadcast();
        PayrollVault vault = new PayrollVault(ARC_USDC);
        vm.stopBroadcast();

        console.log("PayrollVault deployed at:", address(vault));
    }
}
