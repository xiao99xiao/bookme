// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test, console2} from "forge-std/Test.sol";
import {BookingEscrow} from "../src/BookingEscrow.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/**
 * @title ProductionReadinessTest
 * @dev Comprehensive production readiness validation suite
 * @notice Validates contract is ready for testnet/mainnet deployment
 */
contract ProductionReadinessTest is Test {
    BookingEscrow public escrow;
    MockUSDC public usdc;
    
    address public owner;
    address public backendSigner;
    address public platformFeeWallet;
    address public customer;
    address public provider;
    address public inviter;
    
    uint256 public backendSignerPrivateKey;
    
    bytes32 private constant BOOKING_AUTHORIZATION_TYPEHASH =
        keccak256(
            "BookingAuthorization(bytes32 bookingId,address customer,address provider,address inviter,uint256 amount,uint256 platformFeeRate,uint256 inviterFeeRate,uint256 expiry,uint256 nonce)"
        );

    function setUp() public {
        owner = address(this);
        backendSignerPrivateKey = 0x12341234;
        backendSigner = vm.addr(backendSignerPrivateKey);
        platformFeeWallet = makeAddr("platformFeeWallet");
        customer = makeAddr("customer");
        provider = makeAddr("provider");
        inviter = makeAddr("inviter");

        usdc = new MockUSDC();
        escrow = new BookingEscrow(address(usdc), backendSigner, platformFeeWallet);
        
        // Setup test funds
        usdc.mintUSDC(customer, 1000000e6); // 1M USDC
        vm.prank(customer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // ============ DEPLOYMENT VALIDATION ============
    
    /**
     * @dev Validate contract size is within deployment limits
     */
    function test_ContractSizeWithinLimits() public view {
        uint256 contractSize;
        address escrowAddress = address(escrow);
        
        assembly {
            contractSize := extcodesize(escrowAddress)
        }
        
        // Maximum contract size is 24KB (24576 bytes)
        assertLt(contractSize, 24576, "Contract size exceeds 24KB limit");
        console2.log("Contract size:", contractSize, "bytes");
    }
    
    /**
     * @dev Validate all critical functions are accessible
     */
    function test_CriticalFunctionsAccessible() public {
        // Test view functions
        assertEq(escrow.owner(), owner);
        assertEq(escrow.backendSigner(), backendSigner);
        assertEq(escrow.platformFeeWallet(), platformFeeWallet);
        assertFalse(escrow.paused());
        
        // Test constants
        assertEq(escrow.MAX_PLATFORM_FEE(), 2000);
        assertEq(escrow.MAX_INVITER_FEE(), 1000);
        assertEq(escrow.MAX_TOTAL_FEE(), 3000);
        assertEq(escrow.MAX_CANCELLATION_NON_PARTIES(), 2000);
    }

    // ============ INTEGRATION SCENARIOS ============
    
    /**
     * @dev Test complete booking lifecycle
     */
    function test_CompleteBookingLifecycle() public {
        // 1. Create and pay booking
        bytes32 bookingId = keccak256("lifecycle_test");
        uint256 amount = 1000e6; // 1000 USDC
        
        BookingEscrow.BookingAuthorization memory auth = BookingEscrow.BookingAuthorization({
            bookingId: bookingId,
            customer: customer,
            provider: provider,
            inviter: inviter,
            amount: amount,
            platformFeeRate: 1500, // 15%
            inviterFeeRate: 500,   // 5%
            expiry: block.timestamp + 1 hours,
            nonce: 1
        });
        
        bytes memory signature = signBookingAuthorization(auth, backendSignerPrivateKey);
        
        vm.prank(customer);
        escrow.createAndPayBooking(auth, signature);
        
        // 2. Verify booking state
        {
            (
                bytes32 id,
                address bookingCustomer,
                address bookingProvider,
                address bookingInviter,
                uint256 bookingAmount,
                uint256 platformFeeRate,
                uint256 inviterFeeRate,
                BookingEscrow.BookingStatus status,
            ) = escrow.bookings(bookingId);
            
            assertEq(id, bookingId);
            assertEq(bookingCustomer, customer);
            assertEq(bookingProvider, provider);
            assertEq(bookingInviter, inviter);
            assertEq(bookingAmount, amount);
            assertEq(platformFeeRate, 1500);
            assertEq(inviterFeeRate, 500);
            assertEq(uint256(status), uint256(BookingEscrow.BookingStatus.Paid));
        }
        
        // 3. Complete service
        vm.prank(customer);
        escrow.completeService(bookingId);
        
        // 4. Verify final state and distributions
        (, , , , , , , BookingEscrow.BookingStatus finalStatus, ) = escrow.bookings(bookingId);
        assertEq(uint256(finalStatus), uint256(BookingEscrow.BookingStatus.Completed));
        
        uint256 expectedPlatformFee = amount * 1500 / 10000; // 150 USDC
        uint256 expectedInviterFee = amount * 500 / 10000;   // 50 USDC
        uint256 expectedProviderAmount = amount - expectedPlatformFee - expectedInviterFee; // 800 USDC
        
        assertEq(usdc.balanceOf(provider), expectedProviderAmount);
        assertEq(usdc.balanceOf(platformFeeWallet), expectedPlatformFee);
        assertEq(usdc.balanceOf(inviter), expectedInviterFee);
    }
    
    /**
     * @dev Test multiple concurrent bookings
     */
    function test_MultipleConcurrentBookings() public {
        uint256 numBookings = 10;
        
        for (uint256 i = 1; i <= numBookings; i++) {
            bytes32 bookingId = keccak256(abi.encodePacked("booking", i));
            
            BookingEscrow.BookingAuthorization memory auth = BookingEscrow.BookingAuthorization({
                bookingId: bookingId,
                customer: customer,
                provider: provider,
                inviter: address(0), // No inviter for simplicity
                amount: 100e6 * i,   // Varying amounts
                platformFeeRate: 1000 + uint256(i * 100), // Varying fees
                inviterFeeRate: 0,
                expiry: block.timestamp + 1 hours,
                nonce: i
            });
            
            bytes memory signature = signBookingAuthorization(auth, backendSignerPrivateKey);
            
            vm.prank(customer);
            escrow.createAndPayBooking(auth, signature);
            
            // Verify booking was created
            (bytes32 id, , , , , , , , ) = escrow.bookings(bookingId);
            assertEq(id, bookingId);
        }
        
        console2.log("Successfully created", numBookings, "concurrent bookings");
    }

    // ============ SECURITY VALIDATIONS ============
    
    /**
     * @dev Validate access control is properly configured
     */
    function test_AccessControlValidation() public {
        // Test owner-only functions
        vm.prank(makeAddr("attacker"));
        vm.expectRevert();
        escrow.setBackendSigner(makeAddr("malicious"));
        
        vm.prank(makeAddr("attacker"));
        vm.expectRevert();
        escrow.setPlatformFeeWallet(makeAddr("malicious"));
        
        vm.prank(makeAddr("attacker"));
        vm.expectRevert();
        escrow.pause();
        
        // Test backend-only functions
        vm.prank(makeAddr("attacker"));
        vm.expectRevert("BookingEscrow: only backend can cancel");
        escrow.cancelBookingAsBackend(keccak256("test"), "hack attempt");
    }
    
    /**
     * @dev Validate pause mechanism works correctly
     */
    function test_PauseMechanismValidation() public {
        // Pause contract
        escrow.pause();
        assertTrue(escrow.paused());
        
        // Try to create booking while paused
        bytes32 bookingId = keccak256("paused_test");
        BookingEscrow.BookingAuthorization memory auth = BookingEscrow.BookingAuthorization({
            bookingId: bookingId,
            customer: customer,
            provider: provider,
            inviter: address(0),
            amount: 1000e6,
            platformFeeRate: 1500,
            inviterFeeRate: 0,
            expiry: block.timestamp + 1 hours,
            nonce: 100
        });
        
        bytes memory signature = signBookingAuthorization(auth, backendSignerPrivateKey);
        
        vm.expectRevert();
        vm.prank(customer);
        escrow.createAndPayBooking(auth, signature);
        
        // Unpause and verify operations resume
        escrow.unpause();
        assertFalse(escrow.paused());
        
        // Should work now
        vm.prank(customer);
        escrow.createAndPayBooking(auth, signature);
    }

    // ============ EDGE CASE VALIDATIONS ============
    
    /**
     * @dev Test handling of zero inviter address
     */
    function test_ZeroInviterHandling() public {
        bytes32 bookingId = keccak256("zero_inviter");
        
        BookingEscrow.BookingAuthorization memory auth = BookingEscrow.BookingAuthorization({
            bookingId: bookingId,
            customer: customer,
            provider: provider,
            inviter: address(0), // No inviter
            amount: 1000e6,
            platformFeeRate: 1500,
            inviterFeeRate: 500, // Fee rate set but no inviter
            expiry: block.timestamp + 1 hours,
            nonce: 200
        });
        
        bytes memory signature = signBookingAuthorization(auth, backendSignerPrivateKey);
        
        vm.prank(customer);
        escrow.createAndPayBooking(auth, signature);
        
        // Complete service
        vm.prank(customer);
        escrow.completeService(bookingId);
        
        // Verify inviter fee is not distributed
        assertEq(usdc.balanceOf(address(0)), 0);
        
        // Provider should get inviter's portion
        uint256 platformFee = 1000e6 * 1500 / 10000;
        uint256 expectedProviderAmount = 1000e6 - platformFee; // No inviter fee deducted
        assertEq(usdc.balanceOf(provider), expectedProviderAmount);
    }
    
    /**
     * @dev Test minimum viable booking amount
     */
    function test_MinimumViableBooking() public {
        bytes32 bookingId = keccak256("minimum_booking");
        uint256 minAmount = 100e6; // 100 USDC minimum
        
        BookingEscrow.BookingAuthorization memory auth = BookingEscrow.BookingAuthorization({
            bookingId: bookingId,
            customer: customer,
            provider: provider,
            inviter: inviter,
            amount: minAmount,
            platformFeeRate: 1500,
            inviterFeeRate: 500,
            expiry: block.timestamp + 1 hours,
            nonce: 300
        });
        
        bytes memory signature = signBookingAuthorization(auth, backendSignerPrivateKey);
        
        vm.prank(customer);
        escrow.createAndPayBooking(auth, signature);
        
        vm.prank(customer);
        escrow.completeService(bookingId);
        
        // Verify proper distribution even for small amounts
        uint256 platformFee = minAmount * 1500 / 10000; // 15 USDC
        uint256 inviterFee = minAmount * 500 / 10000;   // 5 USDC
        uint256 providerAmount = minAmount - platformFee - inviterFee; // 80 USDC
        
        assertEq(usdc.balanceOf(provider), providerAmount);
        assertEq(usdc.balanceOf(platformFeeWallet), platformFee);
        assertEq(usdc.balanceOf(inviter), inviterFee);
    }

    // ============ GAS OPTIMIZATION VALIDATION ============
    
    /**
     * @dev Measure gas costs for critical operations
     */
    function test_GasCostMeasurement() public {
        bytes32 bookingId = keccak256("gas_test");
        
        BookingEscrow.BookingAuthorization memory auth = BookingEscrow.BookingAuthorization({
            bookingId: bookingId,
            customer: customer,
            provider: provider,
            inviter: inviter,
            amount: 1000e6,
            platformFeeRate: 1500,
            inviterFeeRate: 500,
            expiry: block.timestamp + 1 hours,
            nonce: 400
        });
        
        bytes memory signature = signBookingAuthorization(auth, backendSignerPrivateKey);
        
        // Measure createAndPayBooking gas
        uint256 gasBefore = gasleft();
        vm.prank(customer);
        escrow.createAndPayBooking(auth, signature);
        uint256 createGasUsed = gasBefore - gasleft();
        
        // Measure completeService gas
        gasBefore = gasleft();
        vm.prank(customer);
        escrow.completeService(bookingId);
        uint256 completeGasUsed = gasBefore - gasleft();
        
        console2.log("Gas costs:");
        console2.log("- createAndPayBooking:", createGasUsed);
        console2.log("- completeService:", completeGasUsed);
        
        // Ensure gas costs are reasonable
        assertLt(createGasUsed, 500000, "Create booking gas too high");
        assertLt(completeGasUsed, 300000, "Complete service gas too high");
    }

    // ============ HELPER FUNCTIONS ============
    
    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("BookMe Escrow"),
                keccak256("1"),
                block.chainid,
                address(escrow)
            )
        );
    }

    function signBookingAuthorization(
        BookingEscrow.BookingAuthorization memory auth,
        uint256 privateKey
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                BOOKING_AUTHORIZATION_TYPEHASH,
                auth.bookingId,
                auth.customer,
                auth.provider,
                auth.inviter,
                auth.amount,
                auth.platformFeeRate,
                auth.inviterFeeRate,
                auth.expiry,
                auth.nonce
            )
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }
}