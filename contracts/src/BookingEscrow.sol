// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title BookingEscrow
 * @dev Escrow contract for Nook service bookings on Base blockchain
 * @notice Handles USDC escrow for service bookings with backend-signed authorizations
 */
contract BookingEscrow is EIP712, Ownable, Pausable, ReentrancyGuard {
    using ECDSA for bytes32;

    // ============ CONSTANTS ============

    uint256 public constant MAX_PLATFORM_FEE = 2000; // 20%
    uint256 public constant MAX_INVITER_FEE = 1000;  // 10%
    uint256 public constant MAX_TOTAL_FEE = 3000;    // 30%
    uint256 public constant MAX_CANCELLATION_NON_PARTIES = 2000; // 20%

    // ============ STRUCTS ============

    struct Booking {
        bytes32 id;              // Unique booking identifier
        address customer;        // Customer wallet address
        address provider;        // Provider wallet address
        address inviter;         // Inviter wallet (address(0) if no inviter)
        uint256 amount;          // Actual USDC amount paid (may be less than original if points used)
        uint256 originalAmount;  // Original service price (used for fee calculation)
        uint256 platformFeeRate; // Platform fee rate for this booking (basis points)
        uint256 inviterFeeRate;  // Inviter fee rate for this booking (basis points)
        BookingStatus status;    // Current booking state
        uint256 createdAt;      // Block timestamp when booking was created
    }

    struct BookingAuthorization {
        bytes32 bookingId;
        address customer;
        address provider;
        address inviter;
        uint256 amount;          // Actual USDC to pay (may be less if points used)
        uint256 originalAmount;  // Original service price (for fee calculation)
        uint256 platformFeeRate;
        uint256 inviterFeeRate;
        uint256 expiry;          // Signature expiry timestamp
        uint256 nonce;           // Global nonce from backend
    }

    struct CancellationAuthorization {
        bytes32 bookingId;
        uint256 customerAmount;  // Amount to send to customer (wei)
        uint256 providerAmount;  // Amount to send to provider (wei)
        uint256 platformAmount;  // Amount to send to platform (wei)
        uint256 inviterAmount;   // Amount to send to inviter (wei)
        string reason;           // Cancellation reason code
        uint256 expiry;          // Signature expiry timestamp
        uint256 nonce;           // Global nonce from backend
    }

    enum BookingStatus {
        Paid,        // Customer paid, funds escrowed (initial state)
        Completed,   // Service done, funds distributed
        Cancelled,   // Cancelled, funds returned according to policy
        Disputed     // Future: under dispute resolution
    }

    // ============ STATE VARIABLES ============

    IERC20 public immutable USDC;
    mapping(bytes32 => Booking) public bookings;
    mapping(uint256 => bool) public usedNonces;

    address public backendSigner;
    address public platformFeeWallet;
    
    // Array to store all booking IDs for enumeration
    bytes32[] public allBookingIds;

    // ============ TYPE HASHES ============

    bytes32 private constant BOOKING_AUTHORIZATION_TYPEHASH =
        keccak256(
            "BookingAuthorization(bytes32 bookingId,address customer,address provider,address inviter,uint256 amount,uint256 originalAmount,uint256 platformFeeRate,uint256 inviterFeeRate,uint256 expiry,uint256 nonce)"
        );

    bytes32 private constant CANCELLATION_AUTHORIZATION_TYPEHASH =
        keccak256(
            "CancellationAuthorization(bytes32 bookingId,uint256 customerAmount,uint256 providerAmount,uint256 platformAmount,uint256 inviterAmount,string reason,uint256 expiry,uint256 nonce)"
        );

    // ============ EVENTS ============

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

    // ============ CONSTRUCTOR ============

    constructor(
        address _usdc,
        address _backendSigner,
        address _platformFeeWallet
    ) EIP712("Nook Escrow", "1") Ownable(msg.sender) {
        require(_usdc != address(0), "BookingEscrow: invalid USDC address");
        require(_backendSigner != address(0), "BookingEscrow: invalid backend signer");
        require(_platformFeeWallet != address(0), "BookingEscrow: invalid platform wallet");

        USDC = IERC20(_usdc);
        backendSigner = _backendSigner;
        platformFeeWallet = _platformFeeWallet;
    }

    // ============ CUSTOMER FUNCTIONS ============

    /**
     * @dev Create booking and pay in ONE transaction with backend signature
     * @param auth Booking authorization struct with all details
     * @param signature Backend's EIP-712 signature
     */
    function createAndPayBooking(
        BookingAuthorization calldata auth,
        bytes calldata signature
    ) external whenNotPaused nonReentrant {
        // Verify signature not expired and nonce not used
        require(auth.expiry > block.timestamp, "BookingEscrow: authorization expired");
        require(!usedNonces[auth.nonce], "BookingEscrow: nonce already used");

        // Validate fee rates don't exceed limits
        require(auth.platformFeeRate <= MAX_PLATFORM_FEE, "BookingEscrow: platform fee too high");
        require(auth.inviterFeeRate <= MAX_INVITER_FEE, "BookingEscrow: inviter fee too high");
        require(
            auth.platformFeeRate + auth.inviterFeeRate <= MAX_TOTAL_FEE,
            "BookingEscrow: combined fees exceed maximum"
        );

        // Verify backend signature using EIP-712
        _verifyBookingAuthorization(auth, signature);

        // Validate addresses and amounts
        require(auth.customer != address(0), "BookingEscrow: invalid customer");
        require(auth.provider != address(0), "BookingEscrow: invalid provider");
        require(auth.amount > 0, "BookingEscrow: amount must be positive");
        require(auth.originalAmount >= auth.amount, "BookingEscrow: original amount must be >= amount");
        require(msg.sender == auth.customer, "BookingEscrow: only authorized customer");

        // Validate that provider + inviter can be paid from amount
        // Provider gets: originalAmount * (10000 - platformFeeRate - inviterFeeRate) / 10000
        // Inviter gets: originalAmount * inviterFeeRate / 10000
        uint256 providerAmount = (auth.originalAmount * (10000 - auth.platformFeeRate - auth.inviterFeeRate)) / 10000;
        uint256 inviterAmount = (auth.originalAmount * auth.inviterFeeRate) / 10000;
        require(auth.amount >= providerAmount + inviterAmount, "BookingEscrow: amount insufficient for provider + inviter");

        // Create booking
        Booking storage booking = bookings[auth.bookingId];
        require(booking.id == bytes32(0), "BookingEscrow: booking already exists");

        booking.id = auth.bookingId;
        booking.customer = auth.customer;
        booking.provider = auth.provider;
        booking.inviter = auth.inviter;
        booking.amount = auth.amount;
        booking.originalAmount = auth.originalAmount;
        booking.platformFeeRate = auth.platformFeeRate;
        booking.inviterFeeRate = auth.inviterFeeRate;
        booking.status = BookingStatus.Paid;
        booking.createdAt = block.timestamp;

        // Mark nonce as used and add to bookings list
        usedNonces[auth.nonce] = true;
        allBookingIds.push(auth.bookingId);

        // Transfer USDC from customer to escrow
        require(
            USDC.transferFrom(auth.customer, address(this), auth.amount),
            "BookingEscrow: USDC transfer failed"
        );

        emit BookingCreatedAndPaid(
            auth.bookingId,
            auth.customer,
            auth.provider,
            auth.inviter,
            auth.amount,
            auth.platformFeeRate,
            auth.inviterFeeRate
        );
    }

    /**
     * @dev Complete service and distribute funds
     * @param bookingId The booking identifier
     */
    function completeService(bytes32 bookingId) external whenNotPaused nonReentrant {
        Booking storage booking = bookings[bookingId];
        
        require(booking.id != bytes32(0), "BookingEscrow: booking not found");
        require(
            msg.sender == booking.customer || msg.sender == backendSigner,
            "BookingEscrow: only customer or backend can complete"
        );
        require(booking.status == BookingStatus.Paid, "BookingEscrow: booking not in paid status");

        // Update status
        booking.status = BookingStatus.Completed;

        // Calculate distribution based on ORIGINAL amount (not actual paid amount)
        // This ensures provider gets their full share even when points are used
        uint256 providerAmount = (booking.originalAmount * (10000 - booking.platformFeeRate - booking.inviterFeeRate)) / 10000;
        uint256 inviterFee = 0;
        if (booking.inviter != address(0)) {
            inviterFee = (booking.originalAmount * booking.inviterFeeRate) / 10000;
        }

        // Platform gets whatever is left after paying provider and inviter
        // This may be less than expected if points were used (platform absorbs the cost)
        uint256 platformFee = booking.amount - providerAmount - inviterFee;

        // Distribute funds
        require(USDC.transfer(booking.provider, providerAmount), "BookingEscrow: provider transfer failed");

        if (platformFee > 0) {
            require(USDC.transfer(platformFeeWallet, platformFee), "BookingEscrow: platform transfer failed");
        }

        if (inviterFee > 0 && booking.inviter != address(0)) {
            require(USDC.transfer(booking.inviter, inviterFee), "BookingEscrow: inviter transfer failed");
        }

        emit ServiceCompleted(bookingId, booking.provider, providerAmount, platformFee, inviterFee);
    }

    // ============ CANCELLATION FUNCTIONS ============

    /**
     * @dev Customer cancellation with backend-signed authorization
     */
    function cancelBookingAsCustomer(
        bytes32 bookingId,
        CancellationAuthorization calldata auth,
        bytes calldata signature
    ) external whenNotPaused nonReentrant {
        _processCancellation(bookingId, auth, signature, msg.sender);
    }

    /**
     * @dev Provider cancellation with backend-signed authorization
     */
    function cancelBookingAsProvider(
        bytes32 bookingId,
        CancellationAuthorization calldata auth,
        bytes calldata signature
    ) external whenNotPaused nonReentrant {
        _processCancellation(bookingId, auth, signature, msg.sender);
    }

    /**
     * @dev Backend cancellation (returns 100% to customer)
     */
    function cancelBookingAsBackend(
        bytes32 bookingId,
        string calldata reason
    ) external whenNotPaused nonReentrant {
        require(msg.sender == backendSigner, "BookingEscrow: only backend can cancel");
        
        Booking storage booking = bookings[bookingId];
        require(booking.id != bytes32(0), "BookingEscrow: booking not found");
        require(booking.status == BookingStatus.Paid, "BookingEscrow: booking not in paid status");

        // Update status
        booking.status = BookingStatus.Cancelled;

        // Return 100% to customer
        require(USDC.transfer(booking.customer, booking.amount), "BookingEscrow: customer refund failed");

        emit BookingCancelled(bookingId, msg.sender, booking.amount, 0, 0, 0, reason);
    }

    // ============ ADMINISTRATIVE FUNCTIONS ============

    /**
     * @dev Update backend signer address
     */
    function setBackendSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "BookingEscrow: invalid signer address");
        address oldSigner = backendSigner;
        backendSigner = newSigner;
        emit BackendSignerUpdated(oldSigner, newSigner);
    }

    /**
     * @dev Update platform fee wallet address
     */
    function setPlatformFeeWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "BookingEscrow: invalid wallet address");
        address oldWallet = platformFeeWallet;
        platformFeeWallet = newWallet;
        emit PlatformFeeWalletUpdated(oldWallet, newWallet);
    }

    /**
     * @dev Pause all contract operations
     */
    function pause() external onlyOwner {
        _pause();
        emit ContractPaused(msg.sender);
    }

    /**
     * @dev Unpause contract operations
     */
    function unpause() external onlyOwner {
        _unpause();
        emit ContractUnpaused(msg.sender);
    }

    /**
     * @dev Get contract information
     */
    function getContractInfo() external view returns (
        address currentOwner,
        address currentBackendSigner,
        address currentPlatformWallet,
        bool isPaused
    ) {
        return (owner(), backendSigner, platformFeeWallet, paused());
    }

    /**
     * @dev Get all booking IDs
     */
    function getAllBookingIds() external view returns (bytes32[] memory) {
        return allBookingIds;
    }

    /**
     * @dev Get all active (paid status) booking IDs
     */
    function getActiveBookingIds() external view returns (bytes32[] memory) {
        bytes32[] memory activeIds = new bytes32[](allBookingIds.length);
        uint256 activeCount = 0;
        
        for (uint256 i = 0; i < allBookingIds.length; i++) {
            bytes32 bookingId = allBookingIds[i];
            if (bookings[bookingId].status == BookingStatus.Paid) {
                activeIds[activeCount] = bookingId;
                activeCount++;
            }
        }
        
        // Resize array to actual count
        bytes32[] memory result = new bytes32[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            result[i] = activeIds[i];
        }
        
        return result;
    }

    /**
     * @dev Get booking count
     */
    function getBookingCount() external view returns (uint256) {
        return allBookingIds.length;
    }

    /**
     * @dev Get active booking count
     */
    function getActiveBookingCount() external view returns (uint256) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < allBookingIds.length; i++) {
            if (bookings[allBookingIds[i]].status == BookingStatus.Paid) {
                activeCount++;
            }
        }
        return activeCount;
    }

    // ============ INTERNAL FUNCTIONS ============

    /**
     * @dev Verify booking authorization signature
     */
    function _verifyBookingAuthorization(
        BookingAuthorization calldata auth,
        bytes calldata signature
    ) internal view {
        bytes32 structHash = keccak256(
            abi.encode(
                BOOKING_AUTHORIZATION_TYPEHASH,
                auth.bookingId,
                auth.customer,
                auth.provider,
                auth.inviter,
                auth.amount,
                auth.originalAmount,
                auth.platformFeeRate,
                auth.inviterFeeRate,
                auth.expiry,
                auth.nonce
            )
        );

        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.recover(signature);
        require(signer == backendSigner, "BookingEscrow: invalid backend signature");
    }

    /**
     * @dev Verify cancellation authorization signature
     */
    function _verifyCancellationAuthorization(
        CancellationAuthorization calldata auth,
        bytes calldata signature
    ) internal view {
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

        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.recover(signature);
        require(signer == backendSigner, "BookingEscrow: invalid backend signature");
    }

    /**
     * @dev Process cancellation with authorization
     */
    function _processCancellation(
        bytes32 bookingId,
        CancellationAuthorization calldata auth,
        bytes calldata signature,
        address initiator
    ) internal {
        // Verify authorization
        require(auth.expiry > block.timestamp, "BookingEscrow: authorization expired");
        require(!usedNonces[auth.nonce], "BookingEscrow: nonce already used");
        require(auth.bookingId == bookingId, "BookingEscrow: booking ID mismatch");
        _verifyCancellationAuthorization(auth, signature);

        Booking storage booking = bookings[bookingId];
        require(booking.id != bytes32(0), "BookingEscrow: booking not found");
        require(booking.status == BookingStatus.Paid, "BookingEscrow: booking not in paid status");
        require(
            initiator == booking.customer || initiator == booking.provider,
            "BookingEscrow: unauthorized cancellation"
        );

        // Validate distribution amounts
        uint256 totalDistribution = auth.customerAmount + auth.providerAmount + 
                                   auth.platformAmount + auth.inviterAmount;
        require(totalDistribution == booking.amount, "BookingEscrow: invalid distribution amounts");

        // Validate cancellation limits (platform + inviter <= 20%)
        uint256 nonPartiesAmount = auth.platformAmount + auth.inviterAmount;
        require(
            nonPartiesAmount <= (booking.amount * MAX_CANCELLATION_NON_PARTIES) / 10000,
            "BookingEscrow: cancellation fees exceed 20% limit"
        );

        // Update status and mark nonce as used
        booking.status = BookingStatus.Cancelled;
        usedNonces[auth.nonce] = true;

        // Distribute funds according to authorization
        if (auth.customerAmount > 0) {
            require(USDC.transfer(booking.customer, auth.customerAmount), "BookingEscrow: customer transfer failed");
        }
        if (auth.providerAmount > 0) {
            require(USDC.transfer(booking.provider, auth.providerAmount), "BookingEscrow: provider transfer failed");
        }
        if (auth.platformAmount > 0) {
            require(USDC.transfer(platformFeeWallet, auth.platformAmount), "BookingEscrow: platform transfer failed");
        }
        if (auth.inviterAmount > 0 && booking.inviter != address(0)) {
            require(USDC.transfer(booking.inviter, auth.inviterAmount), "BookingEscrow: inviter transfer failed");
        }

        emit BookingCancelled(
            bookingId,
            initiator,
            auth.customerAmount,
            auth.providerAmount,
            auth.platformAmount,
            auth.inviterAmount,
            auth.reason
        );
    }
}