// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {BookingEscrow} from "../src/BookingEscrow.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
/**
 * @title BookingEscrowTest
 * @dev Comprehensive test suite for BookingEscrow contract using TDD approach
 */
contract BookingEscrowTest is Test {
    BookingEscrow public escrow;
    MockUSDC public usdc;

    // Test accounts
    address public owner;
    address public backendSigner;
    address public platformFeeWallet;
    address public customer;
    address public provider;
    address public inviter;

    // Private keys for signing
    uint256 public backendSignerPrivateKey;
    uint256 public customerPrivateKey;
    uint256 public providerPrivateKey;

    // Test constants
    uint256 public constant AMOUNT = 1000e6; // 1000 USDC
    uint256 public constant PLATFORM_FEE_RATE = 1500; // 15%
    uint256 public constant INVITER_FEE_RATE = 500; // 5%
    
    // Using BookingEscrow structs directly

    // Type hashes
    bytes32 private constant BOOKING_AUTHORIZATION_TYPEHASH =
        keccak256(
            "BookingAuthorization(bytes32 bookingId,address customer,address provider,address inviter,uint256 amount,uint256 platformFeeRate,uint256 inviterFeeRate,uint256 expiry,uint256 nonce)"
        );

    bytes32 private constant CANCELLATION_AUTHORIZATION_TYPEHASH =
        keccak256(
            "CancellationAuthorization(bytes32 bookingId,uint256 customerAmount,uint256 providerAmount,uint256 platformAmount,uint256 inviterAmount,string reason,uint256 expiry,uint256 nonce)"
        );
    
    event BookingCreatedAndPaid(
        bytes32 indexed bookingId,
        address indexed customer,
        address indexed provider,
        address inviter,
        uint256 amount,
        uint256 platformFeeRate,
        uint256 inviterFeeRate
    );

    event ServiceCompleted(
        bytes32 indexed bookingId,
        address indexed provider,
        uint256 providerAmount,
        uint256 platformFee,
        uint256 inviterFee
    );

    event BookingCancelled(
        bytes32 indexed bookingId,
        address indexed cancelledBy,
        uint256 customerAmount,
        uint256 providerAmount,
        uint256 platformAmount,
        uint256 inviterAmount,
        string reason
    );

    // Administrative events
    event BackendSignerUpdated(address indexed oldSigner, address indexed newSigner);
    event PlatformFeeWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event ContractPaused(address indexed by);
    event ContractUnpaused(address indexed by);

    function setUp() public {
        // Set up test accounts
        owner = address(this);
        backendSignerPrivateKey = 0x12341234;
        backendSigner = vm.addr(backendSignerPrivateKey);
        platformFeeWallet = makeAddr("platformFeeWallet");
        
        customerPrivateKey = 0x11111111;
        customer = vm.addr(customerPrivateKey);
        
        providerPrivateKey = 0x22222222;
        provider = vm.addr(providerPrivateKey);
        
        inviter = makeAddr("inviter");

        // Deploy mock USDC
        usdc = new MockUSDC();

        // Deploy BookingEscrow contract
        escrow = new BookingEscrow(address(usdc), backendSigner, platformFeeWallet);

        // Mint USDC to customer for testing
        usdc.mintUSDC(customer, 10000); // 10,000 USDC
        
        // Approve escrow contract to spend customer's USDC
        vm.prank(customer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // ============ CONSTRUCTOR TESTS ============

    function test_Constructor_SetsInitialState() public view {
        assertEq(address(escrow.USDC()), address(usdc));
        assertEq(escrow.owner(), owner);
        assertEq(escrow.backendSigner(), backendSigner);
        assertEq(escrow.platformFeeWallet(), platformFeeWallet);
        assertEq(escrow.paused(), false);
    }

    function test_Constructor_RevertsWithZeroUSDC() public {
        vm.expectRevert("BookingEscrow: invalid USDC address");
        new BookingEscrow(address(0), backendSigner, platformFeeWallet);
    }

    function test_Constructor_RevertsWithZeroBackendSigner() public {
        vm.expectRevert("BookingEscrow: invalid backend signer");
        new BookingEscrow(address(usdc), address(0), platformFeeWallet);
    }

    function test_Constructor_RevertsWithZeroPlatformWallet() public {
        vm.expectRevert("BookingEscrow: invalid platform wallet");
        new BookingEscrow(address(usdc), backendSigner, address(0));
    }

    // ============ BOOKING CREATION TESTS ============

    function test_CreateAndPayBooking_Success() public {
        // Prepare booking authorization
        bytes32 bookingId = keccak256("booking1");
        
        BookingEscrow.BookingAuthorization memory auth = BookingEscrow.BookingAuthorization({
            bookingId: bookingId,
            customer: customer,
            provider: provider,
            inviter: inviter,
            amount: AMOUNT,
            platformFeeRate: PLATFORM_FEE_RATE,
            inviterFeeRate: INVITER_FEE_RATE,
            expiry: block.timestamp + 1 hours,
            nonce: 1
        });

        bytes memory signature = signBookingAuthorization(auth, backendSignerPrivateKey);

        // Expect event (bookingId, customer, provider are indexed)
        vm.expectEmit(true, true, true, true);
        emit BookingCreatedAndPaid(bookingId, customer, provider, inviter, AMOUNT, PLATFORM_FEE_RATE, INVITER_FEE_RATE);

        // Create booking
        vm.prank(customer);
        escrow.createAndPayBooking(auth, signature);

        // Verify booking state
        (
            bytes32 id,
            address bookingCustomer,
            address bookingProvider,
            address bookingInviter,
            uint256 amount,
            uint256 platformFeeRate,
            uint256 inviterFeeRate,
            BookingEscrow.BookingStatus status,
            uint256 createdAt
        ) = escrow.bookings(bookingId);

        assertEq(id, bookingId);
        assertEq(bookingCustomer, customer);
        assertEq(bookingProvider, provider);
        assertEq(bookingInviter, inviter);
        assertEq(amount, AMOUNT);
        assertEq(platformFeeRate, PLATFORM_FEE_RATE);
        assertEq(inviterFeeRate, INVITER_FEE_RATE);
        assertEq(uint256(status), uint256(BookingEscrow.BookingStatus.Paid));
        assertEq(createdAt, block.timestamp);

        // Verify nonce is used
        assertTrue(escrow.usedNonces(1));

        // Verify USDC transfer
        assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
        assertEq(usdc.balanceOf(customer), 9000e6); // 10,000 - 1,000
    }

    function test_CreateAndPayBooking_RevertsWithExpiredAuthorization() public {
        bytes32 bookingId = keccak256("booking1");
        
        BookingEscrow.BookingAuthorization memory auth = BookingEscrow.BookingAuthorization({
            bookingId: bookingId,
            customer: customer,
            provider: provider,
            inviter: inviter,
            amount: AMOUNT,
            platformFeeRate: PLATFORM_FEE_RATE,
            inviterFeeRate: INVITER_FEE_RATE,
            expiry: block.timestamp - 1, // Expired
            nonce: 1
        });

        bytes memory signature = signBookingAuthorization(auth, backendSignerPrivateKey);

        vm.expectRevert("BookingEscrow: authorization expired");
        vm.prank(customer);
        escrow.createAndPayBooking(auth, signature);
    }

    function test_CreateAndPayBooking_RevertsWithUsedNonce() public {
        // First booking with nonce 1
        bytes32 bookingId1 = keccak256("booking1");
        
        BookingEscrow.BookingAuthorization memory auth1 = BookingEscrow.BookingAuthorization({
            bookingId: bookingId1,
            customer: customer,
            provider: provider,
            inviter: inviter,
            amount: AMOUNT,
            platformFeeRate: PLATFORM_FEE_RATE,
            inviterFeeRate: INVITER_FEE_RATE,
            expiry: block.timestamp + 1 hours,
            nonce: 1
        });

        bytes memory signature1 = signBookingAuthorization(auth1, backendSignerPrivateKey);

        vm.prank(customer);
        escrow.createAndPayBooking(auth1, signature1);

        // Second booking with same nonce 1
        bytes32 bookingId2 = keccak256("booking2");
        
        BookingEscrow.BookingAuthorization memory auth2 = BookingEscrow.BookingAuthorization({
            bookingId: bookingId2,
            customer: customer,
            provider: provider,
            inviter: inviter,
            amount: AMOUNT,
            platformFeeRate: PLATFORM_FEE_RATE,
            inviterFeeRate: INVITER_FEE_RATE,
            expiry: block.timestamp + 1 hours,
            nonce: 1 // Same nonce
        });

        bytes memory signature2 = signBookingAuthorization(auth2, backendSignerPrivateKey);

        vm.expectRevert("BookingEscrow: nonce already used");
        vm.prank(customer);
        escrow.createAndPayBooking(auth2, signature2);
    }

    function test_CreateAndPayBooking_RevertsWithExcessivePlatformFee() public {
        bytes32 bookingId = keccak256("booking1");
        
        BookingEscrow.BookingAuthorization memory auth = BookingEscrow.BookingAuthorization({
            bookingId: bookingId,
            customer: customer,
            provider: provider,
            inviter: inviter,
            amount: AMOUNT,
            platformFeeRate: 2500, // 25% > 20% max
            inviterFeeRate: INVITER_FEE_RATE,
            expiry: block.timestamp + 1 hours,
            nonce: 1
        });

        bytes memory signature = signBookingAuthorization(auth, backendSignerPrivateKey);

        vm.expectRevert("BookingEscrow: platform fee too high");
        vm.prank(customer);
        escrow.createAndPayBooking(auth, signature);
    }

    function test_CreateAndPayBooking_RevertsWithExcessiveInviterFee() public {
        bytes32 bookingId = keccak256("booking1");
        
        BookingEscrow.BookingAuthorization memory auth = BookingEscrow.BookingAuthorization({
            bookingId: bookingId,
            customer: customer,
            provider: provider,
            inviter: inviter,
            amount: AMOUNT,
            platformFeeRate: PLATFORM_FEE_RATE,
            inviterFeeRate: 1500, // 15% > 10% max
            expiry: block.timestamp + 1 hours,
            nonce: 1
        });

        bytes memory signature = signBookingAuthorization(auth, backendSignerPrivateKey);

        vm.expectRevert("BookingEscrow: inviter fee too high");
        vm.prank(customer);
        escrow.createAndPayBooking(auth, signature);
    }

    function test_CreateAndPayBooking_RevertsWithExcessiveTotalFees() public {
        bytes32 bookingId = keccak256("booking1");
        
        BookingEscrow.BookingAuthorization memory auth = BookingEscrow.BookingAuthorization({
            bookingId: bookingId,
            customer: customer,
            provider: provider,
            inviter: inviter,
            amount: AMOUNT,
            platformFeeRate: 2000, // 20% (at max individual limit)
            inviterFeeRate: 1100, // 11% -> total 31% > 30% max
            expiry: block.timestamp + 1 hours,
            nonce: 1
        });

        bytes memory signature = signBookingAuthorization(auth, backendSignerPrivateKey);

        vm.expectRevert("BookingEscrow: inviter fee too high"); // Individual limit hit first
        vm.prank(customer);
        escrow.createAndPayBooking(auth, signature);
    }

    function test_CreateAndPayBooking_AcceptsBoundaryValues() public {
        bytes32 bookingId = keccak256("booking1");
        
        BookingEscrow.BookingAuthorization memory auth = BookingEscrow.BookingAuthorization({
            bookingId: bookingId,
            customer: customer,
            provider: provider,
            inviter: inviter,
            amount: AMOUNT,
            platformFeeRate: 2000, // 20% (at max individual limit)
            inviterFeeRate: 1000,  // 10% (at max individual limit)
            // Total: 30% (at max combined limit)
            expiry: block.timestamp + 1 hours,
            nonce: 2 // Different nonce to avoid collision
        });

        bytes memory signature = signBookingAuthorization(auth, backendSignerPrivateKey);

        // This should pass as all limits are at their maximum allowed values
        vm.prank(customer);
        escrow.createAndPayBooking(auth, signature);

        // Verify booking was created
        (bytes32 id, , , , , , , BookingEscrow.BookingStatus status, ) = escrow.bookings(bookingId);
        assertEq(id, bookingId);
        assertEq(uint256(status), uint256(BookingEscrow.BookingStatus.Paid));
    }

    function test_CreateAndPayBooking_RevertsWithInvalidSignature() public {
        bytes32 bookingId = keccak256("booking1");
        
        BookingEscrow.BookingAuthorization memory auth = BookingEscrow.BookingAuthorization({
            bookingId: bookingId,
            customer: customer,
            provider: provider,
            inviter: inviter,
            amount: AMOUNT,
            platformFeeRate: PLATFORM_FEE_RATE,
            inviterFeeRate: INVITER_FEE_RATE,
            expiry: block.timestamp + 1 hours,
            nonce: 1
        });

        // Sign with wrong private key
        bytes memory signature = signBookingAuthorization(auth, customerPrivateKey);

        vm.expectRevert("BookingEscrow: invalid backend signature");
        vm.prank(customer);
        escrow.createAndPayBooking(auth, signature);
    }

    // ============ SERVICE COMPLETION TESTS ============

    function test_CompleteService_Success() public {
        // Create a booking first
        bytes32 bookingId = _createTestBooking();

        // Complete the service  
        vm.expectEmit(true, true, false, true);
        uint256 expectedProviderAmount = AMOUNT * (10000 - PLATFORM_FEE_RATE - INVITER_FEE_RATE) / 10000;
        uint256 expectedPlatformFee = AMOUNT * PLATFORM_FEE_RATE / 10000;
        uint256 expectedInviterFee = AMOUNT * INVITER_FEE_RATE / 10000;
        
        emit ServiceCompleted(bookingId, provider, expectedProviderAmount, expectedPlatformFee, expectedInviterFee);

        vm.prank(customer);
        escrow.completeService(bookingId);

        // Verify booking status
        (, , , , , , , BookingEscrow.BookingStatus status, ) = escrow.bookings(bookingId);
        assertEq(uint256(status), uint256(BookingEscrow.BookingStatus.Completed));

        // Verify fund distribution
        assertEq(usdc.balanceOf(provider), expectedProviderAmount);
        assertEq(usdc.balanceOf(platformFeeWallet), expectedPlatformFee);
        assertEq(usdc.balanceOf(inviter), expectedInviterFee);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_CompleteService_RevertsWithNonExistentBooking() public {
        bytes32 bookingId = keccak256("nonexistent");

        vm.expectRevert("BookingEscrow: booking not found");
        vm.prank(customer);
        escrow.completeService(bookingId);
    }

    function test_CompleteService_RevertsWithUnauthorizedCaller() public {
        bytes32 bookingId = _createTestBooking();

        vm.expectRevert("BookingEscrow: only customer or backend can complete");
        vm.prank(provider);
        escrow.completeService(bookingId);
    }

    function test_CompleteService_RevertsWithWrongStatus() public {
        bytes32 bookingId = _createTestBooking();

        // Complete once
        vm.prank(customer);
        escrow.completeService(bookingId);

        // Try to complete again
        vm.expectRevert("BookingEscrow: booking not in paid status");
        vm.prank(customer);
        escrow.completeService(bookingId);
    }

    // ============ SIGNATURE HELPER FUNCTIONS ============

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

    function signCancellationAuthorization(
        BookingEscrow.CancellationAuthorization memory auth,
        uint256 privateKey
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                CANCELLATION_AUTHORIZATION_TYPEHASH,
                auth.bookingId,
                auth.customerAmount,
                auth.providerAmount,
                auth.platformAmount,
                auth.inviterAmount,
                keccak256(bytes(auth.reason)),
                auth.expiry,
                auth.nonce
            )
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    // ============ CANCELLATION TESTS ============

    function test_CancelBookingAsCustomer_Success() public {
        bytes32 bookingId = _createTestBooking();

        // Create cancellation authorization (100% refund to customer)
        BookingEscrow.CancellationAuthorization memory auth = BookingEscrow.CancellationAuthorization({
            bookingId: bookingId,
            customerAmount: AMOUNT, // 100% refund
            providerAmount: 0,
            platformAmount: 0,
            inviterAmount: 0,
            reason: "Customer cancelled early",
            expiry: block.timestamp + 1 hours,
            nonce: 2
        });

        bytes memory signature = signCancellationAuthorization(auth, backendSignerPrivateKey);

        vm.expectEmit(true, false, false, true);
        emit BookingCancelled(bookingId, customer, AMOUNT, 0, 0, 0, "Customer cancelled early");

        vm.prank(customer);
        escrow.cancelBookingAsCustomer(bookingId, auth, signature);

        // Verify booking status
        (, , , , , , , BookingEscrow.BookingStatus status, ) = escrow.bookings(bookingId);
        assertEq(uint256(status), uint256(BookingEscrow.BookingStatus.Cancelled));

        // Verify fund distribution
        assertEq(usdc.balanceOf(customer), 10000e6); // Got full refund
        assertEq(usdc.balanceOf(provider), 0);
        assertEq(usdc.balanceOf(platformFeeWallet), 0);
        assertEq(usdc.balanceOf(inviter), 0);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_CancelBookingAsProvider_WithPenalty() public {
        bytes32 bookingId = _createTestBooking();

        // Create cancellation authorization (partial penalty to provider)
        BookingEscrow.CancellationAuthorization memory auth = BookingEscrow.CancellationAuthorization({
            bookingId: bookingId,
            customerAmount: AMOUNT * 80 / 100,  // 80% to customer
            providerAmount: AMOUNT * 15 / 100,  // 15% to provider (penalty)
            platformAmount: AMOUNT * 5 / 100,   // 5% to platform
            inviterAmount: 0,
            reason: "Provider cancelled late",
            expiry: block.timestamp + 1 hours,
            nonce: 2
        });

        bytes memory signature = signCancellationAuthorization(auth, backendSignerPrivateKey);

        vm.expectEmit(true, false, false, true);
        emit BookingCancelled(
            bookingId, 
            provider, 
            AMOUNT * 80 / 100, 
            AMOUNT * 15 / 100, 
            AMOUNT * 5 / 100, 
            0, 
            "Provider cancelled late"
        );

        vm.prank(provider);
        escrow.cancelBookingAsProvider(bookingId, auth, signature);

        // Verify fund distribution
        assertEq(usdc.balanceOf(customer), 9000e6 + AMOUNT * 80 / 100); // Original balance + 80% refund
        assertEq(usdc.balanceOf(provider), AMOUNT * 15 / 100);
        assertEq(usdc.balanceOf(platformFeeWallet), AMOUNT * 5 / 100);
    }

    function test_EmergencyCancelBooking_Success() public {
        bytes32 bookingId = _createTestBooking();

        vm.expectEmit(true, false, false, true);
        emit BookingCancelled(bookingId, backendSigner, AMOUNT, 0, 0, 0, "Emergency: fraud detected");

        vm.prank(backendSigner);
        escrow.cancelBookingAsBackend(bookingId, "Emergency: fraud detected");

        // Verify 100% refund to customer
        assertEq(usdc.balanceOf(customer), 10000e6); // Got full refund
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_CancelBooking_RevertsWithExcessiveFees() public {
        bytes32 bookingId = _createTestBooking();

        // Create cancellation authorization with excessive platform+inviter fees (>20%)
        BookingEscrow.CancellationAuthorization memory auth = BookingEscrow.CancellationAuthorization({
            bookingId: bookingId,
            customerAmount: AMOUNT * 70 / 100,  // 70% to customer
            providerAmount: AMOUNT * 5 / 100,   // 5% to provider
            platformAmount: AMOUNT * 15 / 100,  // 15% to platform
            inviterAmount: AMOUNT * 10 / 100,   // 10% to inviter (total non-parties: 25% > 20% limit)
            reason: "Test excessive fees",
            expiry: block.timestamp + 1 hours,
            nonce: 2
        });

        bytes memory signature = signCancellationAuthorization(auth, backendSignerPrivateKey);

        vm.expectRevert("BookingEscrow: cancellation fees exceed 20% limit");
        vm.prank(customer);
        escrow.cancelBookingAsCustomer(bookingId, auth, signature);
    }

    function test_CancelBooking_RevertsWithInvalidDistribution() public {
        bytes32 bookingId = _createTestBooking();

        // Create cancellation authorization with amounts that don't sum to total
        BookingEscrow.CancellationAuthorization memory auth = BookingEscrow.CancellationAuthorization({
            bookingId: bookingId,
            customerAmount: AMOUNT * 50 / 100,  // 50%
            providerAmount: AMOUNT * 30 / 100,  // 30%
            platformAmount: AMOUNT * 10 / 100,  // 10%
            inviterAmount: 0,                   // 0% -> Total: 90% ≠ 100%
            reason: "Invalid distribution test",
            expiry: block.timestamp + 1 hours,
            nonce: 2
        });

        bytes memory signature = signCancellationAuthorization(auth, backendSignerPrivateKey);

        vm.expectRevert("BookingEscrow: invalid distribution amounts");
        vm.prank(customer);
        escrow.cancelBookingAsCustomer(bookingId, auth, signature);
    }

    function test_CancelBooking_RevertsWithUnauthorizedCaller() public {
        bytes32 bookingId = _createTestBooking();

        BookingEscrow.CancellationAuthorization memory auth = BookingEscrow.CancellationAuthorization({
            bookingId: bookingId,
            customerAmount: AMOUNT,
            providerAmount: 0,
            platformAmount: 0,
            inviterAmount: 0,
            reason: "Unauthorized test",
            expiry: block.timestamp + 1 hours,
            nonce: 2
        });

        bytes memory signature = signCancellationAuthorization(auth, backendSignerPrivateKey);

        // Random address tries to cancel
        address randomUser = makeAddr("randomUser");
        vm.expectRevert("BookingEscrow: unauthorized cancellation");
        vm.prank(randomUser);
        escrow.cancelBookingAsCustomer(bookingId, auth, signature);
    }

    // ============ ADMINISTRATIVE TESTS ============

    function test_SetBackendSigner_Success() public {
        address newSigner = makeAddr("newBackendSigner");
        
        vm.expectEmit(true, true, false, false);
        emit BackendSignerUpdated(backendSigner, newSigner);

        escrow.setBackendSigner(newSigner);

        assertEq(escrow.backendSigner(), newSigner);
    }

    function test_SetPlatformFeeWallet_Success() public {
        address newWallet = makeAddr("newPlatformWallet");
        
        vm.expectEmit(true, true, false, false);
        emit PlatformFeeWalletUpdated(platformFeeWallet, newWallet);

        escrow.setPlatformFeeWallet(newWallet);

        assertEq(escrow.platformFeeWallet(), newWallet);
    }

    function test_PauseAndUnpause_Success() public {
        // Test pause
        vm.expectEmit(false, false, false, true);
        emit ContractPaused(owner);

        escrow.pause();
        assertTrue(escrow.paused());

        // Test unpause
        vm.expectEmit(false, false, false, true);
        emit ContractUnpaused(owner);

        escrow.unpause();
        assertFalse(escrow.paused());
    }

    function test_BookingEnumerationFunctions() public {
        // Initially should have no bookings
        assertEq(escrow.getBookingCount(), 0);
        assertEq(escrow.getActiveBookingCount(), 0);
        
        bytes32[] memory allIds = escrow.getAllBookingIds();
        assertEq(allIds.length, 0);
        
        bytes32[] memory activeIds = escrow.getActiveBookingIds();
        assertEq(activeIds.length, 0);
        
        // Create a booking
        bytes32 bookingId1 = _createCustomTestBooking("booking1", 100);
        
        // Should now have one booking
        assertEq(escrow.getBookingCount(), 1);
        assertEq(escrow.getActiveBookingCount(), 1);
        
        allIds = escrow.getAllBookingIds();
        assertEq(allIds.length, 1);
        assertEq(allIds[0], bookingId1);
        
        activeIds = escrow.getActiveBookingIds();
        assertEq(activeIds.length, 1);
        assertEq(activeIds[0], bookingId1);
        
        // Create another booking
        bytes32 bookingId2 = _createCustomTestBooking("booking2", 101);
        
        // Should now have two bookings
        assertEq(escrow.getBookingCount(), 2);
        assertEq(escrow.getActiveBookingCount(), 2);
        
        allIds = escrow.getAllBookingIds();
        assertEq(allIds.length, 2);
        
        activeIds = escrow.getActiveBookingIds();
        assertEq(activeIds.length, 2);
        
        // Complete one booking
        vm.prank(customer);
        escrow.completeService(bookingId1);
        
        // Should still have 2 total bookings but only 1 active
        assertEq(escrow.getBookingCount(), 2);
        assertEq(escrow.getActiveBookingCount(), 1);
        
        allIds = escrow.getAllBookingIds();
        assertEq(allIds.length, 2);
        
        activeIds = escrow.getActiveBookingIds();
        assertEq(activeIds.length, 1);
        assertEq(activeIds[0], bookingId2);
    }

    function test_CreateBooking_RevertsWhenPaused() public {
        escrow.pause();

        BookingEscrow.BookingAuthorization memory auth = BookingEscrow.BookingAuthorization({
            bookingId: keccak256("paused_test"),
            customer: customer,
            provider: provider,
            inviter: inviter,
            amount: AMOUNT,
            platformFeeRate: PLATFORM_FEE_RATE,
            inviterFeeRate: INVITER_FEE_RATE,
            expiry: block.timestamp + 1 hours,
            nonce: 99
        });

        bytes memory signature = signBookingAuthorization(auth, backendSignerPrivateKey);

        vm.expectRevert(); // OpenZeppelin v5 uses custom errors
        vm.prank(customer);
        escrow.createAndPayBooking(auth, signature);
    }

    function test_GetContractInfo() public view {
        (
            address currentOwner,
            address currentBackendSigner,
            address currentPlatformWallet,
            bool isPaused
        ) = escrow.getContractInfo();

        assertEq(currentOwner, owner);
        assertEq(currentBackendSigner, backendSigner);
        assertEq(currentPlatformWallet, platformFeeWallet);
        assertEq(isPaused, false);
    }

    // ============ HELPER FUNCTIONS ============

    function _createTestBooking() internal returns (bytes32) {
        bytes32 bookingId = keccak256("test_booking");
        
        BookingEscrow.BookingAuthorization memory auth = BookingEscrow.BookingAuthorization({
            bookingId: bookingId,
            customer: customer,
            provider: provider,
            inviter: inviter,
            amount: AMOUNT,
            platformFeeRate: PLATFORM_FEE_RATE,
            inviterFeeRate: INVITER_FEE_RATE,
            expiry: block.timestamp + 1 hours,
            nonce: 1
        });

        bytes memory signature = signBookingAuthorization(auth, backendSignerPrivateKey);

        vm.prank(customer);
        escrow.createAndPayBooking(auth, signature);

        return bookingId;
    }

    function _createCustomTestBooking(string memory identifier, uint256 nonce) internal returns (bytes32) {
        bytes32 bookingId = keccak256(bytes(identifier));
        
        BookingEscrow.BookingAuthorization memory auth = BookingEscrow.BookingAuthorization({
            bookingId: bookingId,
            customer: customer,
            provider: provider,
            inviter: inviter,
            amount: AMOUNT,
            platformFeeRate: PLATFORM_FEE_RATE,
            inviterFeeRate: INVITER_FEE_RATE,
            expiry: block.timestamp + 1 hours,
            nonce: nonce
        });

        bytes memory signature = signBookingAuthorization(auth, backendSignerPrivateKey);

        vm.prank(customer);
        escrow.createAndPayBooking(auth, signature);

        return bookingId;
    }
}