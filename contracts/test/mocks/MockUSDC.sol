// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @dev Mock USDC token for testing the BookingEscrow contract
 * Allows minting tokens for testing purposes
 */
contract MockUSDC is ERC20 {
    uint8 private constant DECIMALS = 6; // USDC has 6 decimals

    constructor() ERC20("USD Coin", "USDC") {}

    /**
     * @dev Override decimals to match USDC (6 decimals)
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @dev Mint tokens to any address for testing
     * @param to Address to mint tokens to
     * @param amount Amount to mint (in wei, considering 6 decimals)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @dev Convenience function to mint USDC with proper decimals
     * @param to Address to mint tokens to
     * @param usdcAmount Amount in USDC (e.g., 100 for 100 USDC)
     */
    function mintUSDC(address to, uint256 usdcAmount) external {
        _mint(to, usdcAmount * 10**DECIMALS);
    }
}