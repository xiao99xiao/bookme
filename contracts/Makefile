# Nook Smart Contracts
# Make sure to have .env file with PRIVATE_KEY and ETHERSCAN_API_KEY

# Load environment variables
ifneq (,$(wildcard ./.env))
    include .env
    export
endif

# Default target
.DEFAULT_GOAL := help

.PHONY: help install build test clean deploy-base-sepolia deploy-base verify-base-sepolia verify-base

help: ## Show this help message
	@echo "Nook Smart Contracts"
	@echo ""
	@echo "Available commands:"
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

install: ## Install dependencies
	forge install

build: ## Build contracts
	forge build

test: ## Run tests
	forge test -vvv

clean: ## Clean build artifacts
	forge clean

# Deployment commands
deploy-base-sepolia: ## Deploy to Base Sepolia testnet
	forge script script/Deploy.s.sol:DeployScript --rpc-url base_sepolia --broadcast --verify -vvvv

deploy-base: ## Deploy to Base mainnet
	forge script script/Deploy.s.sol:DeployScript --rpc-url base --broadcast --verify -vvvv

# Verification commands (if deployment verification failed)
verify-base-sepolia: ## Verify contract on Base Sepolia
	@echo "Usage: make verify-base-sepolia CONTRACT=<contract_address> CONTRACT_NAME=<ContractName>"
	forge verify-contract $(CONTRACT) $(CONTRACT_NAME) --chain-id 84532 --etherscan-api-key $(ETHERSCAN_API_KEY)

verify-base: ## Verify contract on Base mainnet
	@echo "Usage: make verify-base CONTRACT=<contract_address> CONTRACT_NAME=<ContractName>"
	forge verify-contract $(CONTRACT) $(CONTRACT_NAME) --chain-id 8453 --etherscan-api-key $(ETHERSCAN_API_KEY)

# Development commands
fork-base-sepolia: ## Fork Base Sepolia for local testing
	anvil --fork-url https://sepolia.base.org --chain-id 84532

fork-base: ## Fork Base mainnet for local testing
	anvil --fork-url https://mainnet.base.org --chain-id 8453