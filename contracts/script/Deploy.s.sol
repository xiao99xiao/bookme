// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";
import {BookingEscrow} from "../src/BookingEscrow.sol";
import {MockUSDC} from "../test/mocks/MockUSDC.sol";

/**
 * @title DeployBookingEscrow
 * @dev Deployment script for BookingEscrow contract on Base Sepolia
 * @notice Run with: forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
 */
contract DeployBookingEscrow is Script {
    // Base Sepolia USDC address
    address public constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    
    // Base Mainnet USDC address  
    address public constant BASE_MAINNET_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external {
        // Handle both hex string (0x...) and uint formats for private key
        uint256 deployerPrivateKey;
        try vm.envUint("PRIVATE_KEY") returns (uint256 key) {
            deployerPrivateKey = key;
        } catch {
            // If envUint fails, try parsing as hex string with 0x prefix added
            string memory privateKeyStr = vm.envString("PRIVATE_KEY");
            string memory prefixedKey = string.concat("0x", privateKeyStr);
            deployerPrivateKey = vm.parseUint(prefixedKey);
        }
        address deployer = vm.addr(deployerPrivateKey);
        
        console2.log("Deploying BookingEscrow with deployer:", deployer);
        console2.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // Determine which USDC address to use based on chain
        address usdcAddress;
        if (block.chainid == 84532) {
            // Base Sepolia
            usdcAddress = BASE_SEPOLIA_USDC;
            console2.log("Deploying on Base Sepolia");
        } else if (block.chainid == 8453) {
            // Base Mainnet
            usdcAddress = BASE_MAINNET_USDC;
            console2.log("Deploying on Base Mainnet");
        } else {
            // For testing, deploy mock USDC
            console2.log("Deploying on unknown network, deploying MockUSDC");
            MockUSDC mockUSDC = new MockUSDC();
            usdcAddress = address(mockUSDC);
            console2.log("MockUSDC deployed at:", usdcAddress);
        }

        // Set deployment parameters
        address backendSigner = vm.envAddress("BACKEND_SIGNER");
        address platformFeeWallet = vm.envAddress("PLATFORM_FEE_WALLET");

        console2.log("USDC Address:", usdcAddress);
        console2.log("Backend Signer:", backendSigner);
        console2.log("Platform Fee Wallet:", platformFeeWallet);

        // Deploy BookingEscrow
        BookingEscrow escrow = new BookingEscrow(
            usdcAddress,
            backendSigner,
            platformFeeWallet
        );

        vm.stopBroadcast();

        console2.log("========== DEPLOYMENT SUCCESSFUL ==========");
        console2.log("BookingEscrow deployed at:", address(escrow));
        console2.log("Chain ID:", block.chainid);
        console2.log("Block Number:", block.number);
        
        // Log contract details
        console2.log("\n========== CONTRACT DETAILS ==========");
        (
            address owner,
            address currentBackendSigner,
            address currentPlatformWallet,
            bool isPaused
        ) = escrow.getContractInfo();
        
        console2.log("Owner:", owner);
        console2.log("Backend Signer:", currentBackendSigner);
        console2.log("Platform Fee Wallet:", currentPlatformWallet);
        console2.log("Is Paused:", isPaused);
        console2.log("USDC Token:", address(escrow.USDC()));

        // Log constants
        console2.log("\n========== FEE LIMITS ==========");
        console2.log("Max Platform Fee:", escrow.MAX_PLATFORM_FEE(), "basis points");
        console2.log("Max Inviter Fee:", escrow.MAX_INVITER_FEE(), "basis points");
        console2.log("Max Total Fee:", escrow.MAX_TOTAL_FEE(), "basis points");
        console2.log("Max Cancellation Non-Parties:", escrow.MAX_CANCELLATION_NON_PARTIES(), "basis points");

        console2.log("\n========== NEXT STEPS ==========");
        console2.log("1. Verify contract on Basescan if --verify flag was used");
        console2.log("2. Set backend signer private key securely");
        console2.log("3. Update frontend with contract address");
        console2.log("4. Test with small amounts first");
        console2.log("5. Consider setting up monitoring and alerts");

        // Verify deployment
        require(escrow.owner() == deployer, "Owner not set correctly");
        require(escrow.backendSigner() == backendSigner, "Backend signer not set correctly");
        require(escrow.platformFeeWallet() == platformFeeWallet, "Platform wallet not set correctly");
        require(address(escrow.USDC()) == usdcAddress, "USDC address not set correctly");
        
        console2.log("\nDeployment verification passed!");
    }
}

/**
 * @title DeployTestEnvironment
 * @dev Deployment script for testing environment with MockUSDC
 */
contract DeployTestEnvironment is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        // Deploy MockUSDC
        MockUSDC usdc = new MockUSDC();
        console2.log("MockUSDC deployed at:", address(usdc));

        // Set test parameters
        address backendSigner = deployer; // Use deployer as backend signer for testing
        address platformFeeWallet = deployer; // Use deployer as platform wallet for testing

        // Deploy BookingEscrow
        BookingEscrow escrow = new BookingEscrow(
            address(usdc),
            backendSigner,
            platformFeeWallet
        );

        // Mint test tokens
        usdc.mintUSDC(deployer, 100000); // 100,000 USDC for testing

        vm.stopBroadcast();

        console2.log("========== TEST ENVIRONMENT DEPLOYED ==========");
        console2.log("BookingEscrow:", address(escrow));
        console2.log("MockUSDC:", address(usdc));
        console2.log("Deployer USDC Balance:", usdc.balanceOf(deployer));
        console2.log("Backend Signer:", backendSigner);
        console2.log("Platform Fee Wallet:", platformFeeWallet);
    }
}