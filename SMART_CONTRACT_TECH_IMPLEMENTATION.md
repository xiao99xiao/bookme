# 🔧 Smart Contract Integration - Technical Implementation Guide
## BookMe Platform - Blockchain Integration Architecture

---

## 📋 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Event Monitoring System](#event-monitoring-system)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Integration](#frontend-integration)
5. [Database Schema](#database-schema)
6. [Security Implementation](#security-implementation)
7. [Error Handling & Recovery](#error-handling--recovery)
8. [Testing Strategy](#testing-strategy)
9. [Deployment & Monitoring](#deployment--monitoring)

---

## 🏗️ Architecture Overview

### System Components
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │ Smart Contract  │
│   (React +      │    │   (Hono +       │    │ (BookingEscrow) │
│    Privy)       │    │   Event         │    │                 │
│                 │    │   Listener)     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │ HTTP/WebSocket        │ WebSocket/HTTP       │ JSON-RPC
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │    │   Event Queue   │    │  Base Sepolia   │
│                 │    │   (Redis)       │    │   Network       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Database      │    │   Monitoring    │    │   RPC Providers │
│   (PostgreSQL)  │    │   (Logs/Alerts) │    │ (Alchemy/Infura)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Technology Stack
- **Blockchain:** Base Sepolia (testnet), Base Mainnet (production)
- **Smart Contract:** Solidity 0.8.27, OpenZeppelin v5
- **RPC Providers:** Alchemy (primary), Infura (fallback), Base RPC (backup)
- **Backend:** Node.js, Hono, ethers.js v6
- **Event Processing:** Redis queues, WebSocket connections
- **Database:** PostgreSQL with blockchain-specific extensions
- **Frontend:** React, TypeScript, Privy smart wallets
- **Monitoring:** Custom logging, Prometheus metrics, alert systems

---

## 📡 Event Monitoring System

### Architecture Pattern: Redundant Multi-Provider Event Listening

```typescript
// Event monitoring architecture with redundancy
interface EventMonitorConfig {
  providers: {
    primary: string;    // Alchemy WebSocket URL
    fallback: string;   // Infura WebSocket URL  
    backup: string;     // Base RPC HTTP URL (polling)
  };
  contractAddress: string;
  startBlock: number;
  batchSize: number;
  retryConfig: {
    maxRetries: number;
    backoffMs: number;
    exponential: boolean;
  };
}

class BlockchainEventMonitor {
  private providers: ethers.WebSocketProvider[];
  private pollingProvider: ethers.JsonRpcProvider;
  private eventQueue: Queue;
  private processedEvents: Set<string>;
  private lastProcessedBlock: number;

  constructor(config: EventMonitorConfig) {
    // Initialize multiple WebSocket providers for redundancy
    this.providers = [
      new ethers.WebSocketProvider(config.providers.primary),
      new ethers.WebSocketProvider(config.providers.fallback)
    ];
    
    // HTTP provider for block polling fallback
    this.pollingProvider = new ethers.JsonRpcProvider(config.providers.backup);
    
    // Redis-backed event processing queue
    this.eventQueue = new Queue('blockchain-events', {
      connection: { host: 'localhost', port: 6379 },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
      }
    });
    
    // Prevent duplicate event processing
    this.processedEvents = new Set();
    this.lastProcessedBlock = config.startBlock;
  }

  async start(): Promise<void> {
    // Start WebSocket listeners
    await this.setupWebSocketListeners();
    
    // Start polling fallback
    await this.setupPollingFallback();
    
    // Start event processing workers
    await this.startEventProcessors();
    
    console.log('🎯 Blockchain event monitoring started');
  }
}
```

### WebSocket Event Listeners Implementation

```typescript
async setupWebSocketListeners(): Promise<void> {
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, this.providers[0]);
  
  // BookingCreatedAndPaid Event
  contract.on("BookingCreatedAndPaid", async (
    bookingId: string,
    customer: string,
    provider: string,
    inviter: string,
    amount: BigNumber,
    platformFeeRate: BigNumber,
    inviterFeeRate: BigNumber,
    event: ethers.Event
  ) => {
    const eventId = `${event.transactionHash}-${event.logIndex}`;
    
    if (this.processedEvents.has(eventId)) {
      return; // Skip duplicate
    }
    
    this.processedEvents.add(eventId);
    
    // Add to processing queue
    await this.eventQueue.add('booking-created-paid', {
      eventType: 'BookingCreatedAndPaid',
      bookingId,
      customer,
      provider,
      inviter,
      amount: amount.toString(),
      platformFeeRate: platformFeeRate.toNumber(),
      inviterFeeRate: inviterFeeRate.toNumber(),
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      logIndex: event.logIndex,
      timestamp: Date.now()
    });
  });

  // ServiceCompleted Event
  contract.on("ServiceCompleted", async (
    bookingId: string,
    provider: string,
    providerAmount: BigNumber,
    platformFee: BigNumber,
    inviterFee: BigNumber,
    event: ethers.Event
  ) => {
    const eventId = `${event.transactionHash}-${event.logIndex}`;
    
    if (this.processedEvents.has(eventId)) return;
    this.processedEvents.add(eventId);
    
    await this.eventQueue.add('service-completed', {
      eventType: 'ServiceCompleted',
      bookingId,
      provider,
      providerAmount: providerAmount.toString(),
      platformFee: platformFee.toString(),
      inviterFee: inviterFee.toString(),
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      timestamp: Date.now()
    });
  });

  // BookingCancelled Event
  contract.on("BookingCancelled", async (
    bookingId: string,
    cancelledBy: string,
    customerAmount: BigNumber,
    providerAmount: BigNumber,
    platformAmount: BigNumber,
    inviterAmount: BigNumber,
    reason: string,
    event: ethers.Event
  ) => {
    const eventId = `${event.transactionHash}-${event.logIndex}`;
    
    if (this.processedEvents.has(eventId)) return;
    this.processedEvents.add(eventId);
    
    await this.eventQueue.add('booking-cancelled', {
      eventType: 'BookingCancelled',
      bookingId,
      cancelledBy,
      customerAmount: customerAmount.toString(),
      providerAmount: providerAmount.toString(),
      platformAmount: platformAmount.toString(),
      inviterAmount: inviterAmount.toString(),
      reason,
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      timestamp: Date.now()
    });
  });

  // Connection management
  this.providers.forEach((provider, index) => {
    provider.on('error', (error) => {
      console.error(`🔴 WebSocket Provider ${index} error:`, error);
      this.handleProviderError(index, error);
    });

    provider.on('close', (code, reason) => {
      console.warn(`🟡 WebSocket Provider ${index} closed: ${code} ${reason}`);
      this.handleProviderReconnection(index);
    });
  });
}
```

### Event-Triggered Monitoring System

```typescript
// Event-specific monitoring that activates only when expecting events
class EventSpecificMonitor {
  private activeMonitors: Map<string, EventMonitor>;
  private pollingProvider: ethers.JsonRpcProvider;

  constructor(pollingProvider: ethers.JsonRpcProvider) {
    this.activeMonitors = new Map();
    this.pollingProvider = pollingProvider;
  }

  // Start monitoring for a specific event after transaction submission
  async startMonitoring(
    eventType: 'BookingCreatedAndPaid' | 'ServiceCompleted' | 'BookingCancelled',
    expectedData: any,
    maxDurationMs: number = 180000 // 3 minutes max
  ): Promise<string> {
    const monitorId = `${eventType}-${expectedData.bookingId}-${Date.now()}`;
    
    const monitor: EventMonitor = {
      eventType,
      expectedData,
      startTime: Date.now(),
      maxDuration: maxDurationMs,
      startBlock: await this.pollingProvider.getBlockNumber(),
      resolved: false
    };

    this.activeMonitors.set(monitorId, monitor);
    
    // Set timeout to stop monitoring
    setTimeout(() => {
      if (this.activeMonitors.has(monitorId)) {
        console.warn(`⚠️ Event monitoring timeout for ${monitorId}`);
        this.stopMonitoring(monitorId);
      }
    }, maxDurationMs);

    // Start polling only for this specific event (Base is fast, usually <30s)
    this.pollForSpecificEvent(monitorId);
    
    return monitorId;
  }

  // Stop monitoring when WebSocket receives the expected event
  stopMonitoring(monitorId: string): void {
    const monitor = this.activeMonitors.get(monitorId);
    if (monitor) {
      monitor.resolved = true;
      this.activeMonitors.delete(monitorId);
      console.log(`✅ Stopped monitoring ${monitorId} after ${Date.now() - monitor.startTime}ms`);
    }
  }

  private async pollForSpecificEvent(monitorId: string): Promise<void> {
    const monitor = this.activeMonitors.get(monitorId);
    if (!monitor || monitor.resolved) return;

    try {
      const currentBlock = await this.pollingProvider.getBlockNumber();
      
      // Only poll if WebSocket hasn't delivered the event yet
      // Since Base is fast (~2-3 seconds), this usually won't execute
      if (Date.now() - monitor.startTime > 30000) { // Wait 30s before polling
        const filter = {
          address: CONTRACT_ADDRESS,
          fromBlock: monitor.startBlock,
          toBlock: currentBlock,
          topics: [ethers.id(this.getEventSignature(monitor.eventType))]
        };
        
        const logs = await this.pollingProvider.getLogs(filter);
        
        for (const log of logs) {
          const parsedLog = this.parseLogForEvent(log, monitor.eventType);
          if (this.matchesExpectedEvent(parsedLog, monitor.expectedData)) {
            console.log(`📡 Found expected event via polling: ${monitorId}`);
            await this.processLogEntry(log);
            this.stopMonitoring(monitorId);
            return;
          }
        }
      }

      // Continue polling if not resolved and within time limit
      if (!monitor.resolved && Date.now() - monitor.startTime < monitor.maxDuration) {
        setTimeout(() => this.pollForSpecificEvent(monitorId), 10000); // Poll every 10s
      }
      
    } catch (error) {
      console.error(`🔴 Specific event polling error for ${monitorId}:`, error);
    }
  }

  private getEventSignature(eventType: string): string {
    const signatures = {
      'BookingCreatedAndPaid': 'BookingCreatedAndPaid(bytes32,address,address,address,uint256,uint256,uint256)',
      'ServiceCompleted': 'ServiceCompleted(bytes32,address,uint256,uint256,uint256)',
      'BookingCancelled': 'BookingCancelled(bytes32,address,uint256,uint256,uint256,uint256,string)'
    };
    return signatures[eventType];
  }

  private matchesExpectedEvent(parsedLog: any, expectedData: any): boolean {
    return parsedLog && 
           parsedLog.bookingId === expectedData.bookingId &&
           parsedLog.customer === expectedData.customer;
  }
}

interface EventMonitor {
  eventType: string;
  expectedData: any;
  startTime: number;
  maxDuration: number;
  startBlock: number;
  resolved: boolean;
}
```

---


## 🛠️ Backend Implementation

### Event Processing Workers

```typescript
// Event processing with database transactions
class EventProcessor {
  private db: Pool; // PostgreSQL connection pool
  private contract: ethers.Contract;
  private redis: Redis;

  async processBookingCreatedPaid(eventData: any): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Find corresponding booking in database
      const bookingQuery = `
        SELECT id, customer_id, provider_id, amount, status 
        FROM bookings 
        WHERE blockchain_booking_id = $1
      `;
      
      const bookingResult = await client.query(bookingQuery, [eventData.bookingId]);
      
      if (bookingResult.rows.length === 0) {
        // Orphaned blockchain event - emergency cancel
        console.error(`🚨 Orphaned booking event: ${eventData.bookingId}`);
        await this.emergencyCancel(eventData.bookingId, "Orphaned booking event");
        return;
      }
      
      const booking = bookingResult.rows[0];
      
      // Update booking status
      const updateQuery = `
        UPDATE bookings SET 
          status = 'PAID',
          blockchain_tx_hash = $1,
          blockchain_confirmed_at = NOW(),
          blockchain_data = $2
        WHERE id = $3
      `;
      
      await client.query(updateQuery, [
        eventData.transactionHash,
        JSON.stringify(eventData),
        booking.id
      ]);
      
      // Record event in tracking table
      const eventQuery = `
        INSERT INTO blockchain_events (
          event_type, transaction_hash, block_number, booking_id, 
          event_data, processing_status
        ) VALUES ($1, $2, $3, $4, $5, 'PROCESSED')
      `;
      
      await client.query(eventQuery, [
        'BookingCreatedAndPaid',
        eventData.transactionHash,
        eventData.blockNumber,
        eventData.bookingId,
        JSON.stringify(eventData)
      ]);
      
      await client.query('COMMIT');
      
      // Send real-time notifications
      await this.sendBookingPaidNotifications(booking, eventData);
      
      console.log(`✅ Processed BookingCreatedAndPaid: ${eventData.bookingId}`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('🔴 Error processing BookingCreatedAndPaid:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async processServiceCompleted(eventData: any): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update booking to completed
      const updateBookingQuery = `
        UPDATE bookings SET 
          status = 'COMPLETED',
          completed_at = NOW(),
          completion_tx_hash = $1
        WHERE blockchain_booking_id = $2
        RETURNING id, customer_id, provider_id, amount
      `;
      
      const bookingResult = await client.query(updateBookingQuery, [
        eventData.transactionHash,
        eventData.bookingId
      ]);
      
      if (bookingResult.rows.length === 0) {
        throw new Error(`Booking not found for completion: ${eventData.bookingId}`);
      }
      
      const booking = bookingResult.rows[0];
      
      // Update provider earnings
      const providerEarnings = parseFloat(ethers.formatUnits(eventData.providerAmount, 6));
      
      const updateEarningsQuery = `
        UPDATE users SET 
          total_earnings = total_earnings + $1,
          completed_services = completed_services + 1,
          updated_at = NOW()
        WHERE id = $2
      `;
      
      await client.query(updateEarningsQuery, [providerEarnings, booking.provider_id]);
      
      // Record platform fees
      const platformFee = parseFloat(ethers.formatUnits(eventData.platformFee, 6));
      const inviterFee = parseFloat(ethers.formatUnits(eventData.inviterFee, 6));
      
      const feeQuery = `
        INSERT INTO platform_fees (
          booking_id, platform_amount, inviter_amount, 
          transaction_hash, recorded_at
        ) VALUES ($1, $2, $3, $4, NOW())
      `;
      
      await client.query(feeQuery, [
        booking.id, platformFee, inviterFee, eventData.transactionHash
      ]);
      
      await client.query('COMMIT');
      
      // Trigger review system
      await this.activateReviewSystem(booking);
      
      console.log(`✅ Processed ServiceCompleted: ${eventData.bookingId}`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('🔴 Error processing ServiceCompleted:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async emergencyCancel(bookingId: string, reason: string): Promise<void> {
    try {
      const backendSigner = new ethers.Wallet(
        process.env.BACKEND_SIGNER_PRIVATE_KEY!,
        this.providers[0]
      );
      
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, backendSigner);
      
      const tx = await contract.emergencyCancelBooking(bookingId, reason);
      await tx.wait();
      
      console.log(`🚨 Emergency cancelled booking ${bookingId}: ${reason}`);
      
    } catch (error) {
      console.error(`🔴 Failed to emergency cancel ${bookingId}:`, error);
    }
  }
}
```

### Signature Generation Service

```typescript
class SignatureService {
  private signer: ethers.Wallet;
  private domain: any;
  private nonceCounter: number;

  constructor(privateKey: string, chainId: number, contractAddress: string) {
    this.signer = new ethers.Wallet(privateKey);
    this.domain = {
      name: "BookingEscrow",
      version: "1",
      chainId: chainId,
      verifyingContract: contractAddress
    };
    this.nonceCounter = Date.now(); // Initialize with timestamp
  }

  async generateBookingAuthorization(params: {
    bookingId: string;
    customer: string;
    provider: string;
    inviter?: string;
    amount: number; // USDC amount
    platformFeeRate?: number;
    inviterFeeRate?: number;
  }): Promise<{ authorization: any; signature: string }> {
    
    const nonce = ++this.nonceCounter;
    const expiry = Math.floor(Date.now() / 1000) + 300; // 5 minutes
    
    const authorization = {
      bookingId: ethers.keccak256(ethers.toUtf8Bytes(params.bookingId)),
      customer: params.customer,
      provider: params.provider,
      inviter: params.inviter || ethers.ZeroAddress,
      amount: ethers.parseUnits(params.amount.toString(), 6), // USDC decimals
      platformFeeRate: params.platformFeeRate || (params.inviter ? 500 : 1000), // 5% if inviter, 10% if no inviter
      inviterFeeRate: params.inviterFeeRate || (params.inviter ? 500 : 0), // 5% if inviter
      expiry: expiry,
      nonce: nonce
    };

    const types = {
      BookingAuthorization: [
        { name: "bookingId", type: "bytes32" },
        { name: "customer", type: "address" },
        { name: "provider", type: "address" },
        { name: "inviter", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "platformFeeRate", type: "uint256" },
        { name: "inviterFeeRate", type: "uint256" },
        { name: "expiry", type: "uint256" },
        { name: "nonce", type: "uint256" }
      ]
    };

    const signature = await this.signer.signTypedData(this.domain, types, authorization);

    // Store nonce to prevent replay
    await this.storeNonce(nonce, params.bookingId);

    return { authorization, signature };
  }

  async generateCancellationAuthorization(params: {
    bookingId: string;
    customerAmount: number;
    providerAmount: number;
    platformAmount: number;
    inviterAmount: number;
    reason: string;
  }): Promise<{ authorization: any; signature: string }> {
    
    const nonce = ++this.nonceCounter;
    const expiry = Math.floor(Date.now() / 1000) + 300;
    
    const authorization = {
      bookingId: ethers.keccak256(ethers.toUtf8Bytes(params.bookingId)),
      customerAmount: ethers.parseUnits(params.customerAmount.toString(), 6),
      providerAmount: ethers.parseUnits(params.providerAmount.toString(), 6),
      platformAmount: ethers.parseUnits(params.platformAmount.toString(), 6),
      inviterAmount: ethers.parseUnits(params.inviterAmount.toString(), 6),
      reason: params.reason,
      expiry: expiry,
      nonce: nonce
    };

    const types = {
      CancellationAuthorization: [
        { name: "bookingId", type: "bytes32" },
        { name: "customerAmount", type: "uint256" },
        { name: "providerAmount", type: "uint256" },
        { name: "platformAmount", type: "uint256" },
        { name: "inviterAmount", type: "uint256" },
        { name: "reason", type: "string" },
        { name: "expiry", type: "uint256" },
        { name: "nonce", type: "uint256" }
      ]
    };

    const signature = await this.signer.signTypedData(this.domain, types, authorization);
    await this.storeNonce(nonce, params.bookingId);

    return { authorization, signature };
  }

  private async storeNonce(nonce: number, bookingId: string): Promise<void> {
    // Store in database to prevent replay attacks
    const query = `
      INSERT INTO signature_nonces (nonce, booking_id, signature_type, used_at)
      VALUES ($1, $2, $3, NOW())
    `;
    // Implementation depends on your database client
  }
}
```

---

## 🌐 Frontend Integration

### Booking Status Updates
Simply add these blockchain status values to your existing booking status badge component:

```typescript
// Add these status cases to your existing BookingStatus enum
enum BookingStatus {
  // Existing statuses...
  PENDING_PAYMENT = 'PENDING_PAYMENT',      // Customer needs to pay with USDC
  PAID = 'PAID',                           // Payment confirmed on blockchain  
  PENDING_COMPLETION = 'PENDING_COMPLETION', // Customer can mark as complete
  COMPLETED = 'COMPLETED',                 // Service completed, funds distributed
  PENDING_CANCELLATION = 'PENDING_CANCELLATION', // Cancellation in progress
  CANCELLED = 'CANCELLED',                 // Cancelled with refund processed
  FAILED = 'FAILED'                        // Payment or transaction failed
}
```

### Smart Contract Integration
```typescript
// Simple payment service for booking transactions
export class BookingPaymentService {
  async payForBooking(bookingId: string): Promise<string> {
    // 1. Get payment authorization from backend
    const response = await fetch(`/api/bookings/${bookingId}/authorize-payment`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${privyToken}` }
    });
    const { authorization, signature } = await response.json();
    
    // 2. Execute payment on blockchain
    const tx = await contract.createAndPayBooking(authorization, signature);
    return tx.hash;
  }

  async completeService(bookingId: string): Promise<string> {
    const tx = await contract.completeService(ethers.keccak256(ethers.toUtf8Bytes(bookingId)));
    return tx.hash;
  }
}
```

---

## 🗄️ Database Schema

### Simple Booking State Management

With blockchain integration, we only need to track whether actions are pending on-chain or confirmed:

```typescript
// Simple booking states that track database vs blockchain status
enum BookingStatus {
  // Basic states
  PENDING_PAYMENT = 'PENDING_PAYMENT',       // Database booking created, waiting for blockchain payment
  PAID = 'PAID',                             // Payment confirmed on blockchain
  PENDING_COMPLETION = 'PENDING_COMPLETION', // Service done, waiting for blockchain completion
  COMPLETED = 'COMPLETED',                   // Completion confirmed on blockchain
  PENDING_CANCELLATION = 'PENDING_CANCELLATION', // Cancellation requested, waiting for blockchain
  CANCELLED = 'CANCELLED',                   // Cancellation confirmed on blockchain
  FAILED = 'FAILED'                          // Transaction failed
}
```

### Extended PostgreSQL Schema

```sql
-- Simple additions to existing bookings table for blockchain tracking
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS blockchain_booking_id VARCHAR(66);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS blockchain_tx_hash VARCHAR(66);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS blockchain_confirmed_at TIMESTAMP;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completion_tx_hash VARCHAR(66);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_tx_hash VARCHAR(66);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS blockchain_data JSONB;

-- Add indexes for blockchain queries
CREATE INDEX IF NOT EXISTS idx_bookings_blockchain_id ON bookings(blockchain_booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_blockchain_tx ON bookings(blockchain_tx_hash);
CREATE INDEX IF NOT EXISTS idx_bookings_status_blockchain ON bookings(status, blockchain_booking_id);

-- Blockchain event tracking table
CREATE TABLE IF NOT EXISTS blockchain_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    log_index INTEGER,
    booking_id VARCHAR(66),
    event_data JSONB NOT NULL,
    processed_at TIMESTAMP DEFAULT NOW(),
    processing_status VARCHAR(20) DEFAULT 'PROCESSED', -- PROCESSED, FAILED, RETRY
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(transaction_hash, log_index) -- Prevent duplicate processing
);

CREATE INDEX IF NOT EXISTS idx_blockchain_events_type ON blockchain_events(event_type);
CREATE INDEX IF NOT EXISTS idx_blockchain_events_booking ON blockchain_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_blockchain_events_status ON blockchain_events(processing_status);
CREATE INDEX IF NOT EXISTS idx_blockchain_events_block ON blockchain_events(block_number);

-- Signature nonces for replay protection
CREATE TABLE IF NOT EXISTS signature_nonces (
    id SERIAL PRIMARY KEY,
    nonce BIGINT UNIQUE NOT NULL,
    used_at TIMESTAMP DEFAULT NOW(),
    booking_id UUID REFERENCES bookings(id),
    signature_type VARCHAR(50) NOT NULL, -- 'booking' | 'cancellation'
    expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_signature_nonces_booking ON signature_nonces(booking_id);
CREATE INDEX IF NOT EXISTS idx_signature_nonces_type ON signature_nonces(signature_type);

-- Platform fees tracking
CREATE TABLE IF NOT EXISTS platform_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    platform_amount DECIMAL(12,6) NOT NULL,
    inviter_amount DECIMAL(12,6) NOT NULL DEFAULT 0,
    transaction_hash VARCHAR(66) NOT NULL,
    recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_fees_booking ON platform_fees(booking_id);
CREATE INDEX IF NOT EXISTS idx_platform_fees_tx ON platform_fees(transaction_hash);

-- System monitoring table
CREATE TABLE IF NOT EXISTS blockchain_system_state (
    id SERIAL PRIMARY KEY,
    last_processed_block BIGINT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    network_name VARCHAR(50) NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert initial state
INSERT INTO blockchain_system_state (last_processed_block, contract_address, network_name)
VALUES (30740428, '0x33ddEd6F8183aa4dAB04E2aE216a5a3f9871405a', 'base-sepolia')
ON CONFLICT DO NOTHING;
```

---

## 🔐 Security Implementation

### Environment Variables Management

```bash
# Backend .env (SECURE - Never commit!)
DATABASE_URL=postgresql://user:pass@localhost:5432/bookme
REDIS_URL=redis://localhost:6379

# Blockchain Configuration
CONTRACT_ADDRESS=0x33ddEd6F8183aa4dAB04E2aE216a5a3f9871405a
CHAIN_ID=84532
USDC_CONTRACT_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# RPC Providers (with API keys)
ALCHEMY_RPC_URL=wss://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY
INFURA_RPC_URL=wss://base-sepolia.infura.io/ws/v3/YOUR_PROJECT_ID
BASE_RPC_URL=https://sepolia.base.org

# Critical Security Keys (PROTECT AT ALL COSTS!)
BACKEND_SIGNER_PRIVATE_KEY=0xYOUR_BACKEND_SIGNER_PRIVATE_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY

# Privy Integration
PRIVY_APP_SECRET=your_privy_app_secret
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Input Validation & Sanitization

```typescript
import { z } from 'zod';

// Validation schemas
const BookingAuthorizationSchema = z.object({
  bookingId: z.string().regex(/^[0-9a-fA-F]{64}$/, 'Invalid booking ID format'),
  customer: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid customer address'),
  provider: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid provider address'),
  inviter: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid inviter address').optional(),
  amount: z.string().regex(/^\d+$/, 'Invalid amount format'),
  platformFeeRate: z.number().min(0).max(2000, 'Platform fee rate too high'),
  inviterFeeRate: z.number().min(0).max(1000, 'Inviter fee rate too high'),
  expiry: z.number().min(Date.now() / 1000, 'Authorization expired'),
  nonce: z.number().positive()
});

const SignatureSchema = z.string().regex(/^0x[0-9a-fA-F]{130}$/, 'Invalid signature format');

// Route validation middleware
export const validateBookingAuthorization = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { authorization, signature } = req.body;
    
    BookingAuthorizationSchema.parse(authorization);
    SignatureSchema.parse(signature);
    
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid request data', details: error });
  }
};
```

### Rate Limiting & DDoS Protection

```typescript
import { RateLimiter } from 'limiter';
import { Redis } from 'ioredis';

class SecurityMiddleware {
  private redis: Redis;
  private rateLimiters: Map<string, RateLimiter>;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.rateLimiters = new Map();
  }

  // Rate limiting for signature generation
  async rateLimitSignatureGeneration(req: Request, res: Response, next: NextFunction) {
    const clientId = req.headers['x-client-id'] || req.ip;
    const key = `signature_rate_limit:${clientId}`;
    
    const count = await this.redis.incr(key);
    
    if (count === 1) {
      await this.redis.expire(key, 60); // 1 minute window
    }
    
    if (count > 10) { // Max 10 signature requests per minute
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        retryAfter: await this.redis.ttl(key)
      });
    }
    
    next();
  }

  // Prevent duplicate nonce usage
  async validateNonce(nonce: number, bookingId: string): Promise<boolean> {
    const key = `nonce:${nonce}`;
    const existing = await this.redis.get(key);
    
    if (existing) {
      return false; // Nonce already used
    }
    
    await this.redis.setex(key, 600, bookingId); // 10 minute expiry
    return true;
  }

  // Monitor for suspicious activity
  async detectSuspiciousActivity(req: Request): Promise<void> {
    const clientId = req.headers['x-client-id'] || req.ip;
    const key = `suspicious_activity:${clientId}`;
    
    // Track failed requests
    if (req.path.includes('/authorize') && res.statusCode >= 400) {
      await this.redis.zincrby(`failed_requests:${clientId}`, 1, Date.now());
      
      // Check if too many failures in short time
      const recentFailures = await this.redis.zcount(
        `failed_requests:${clientId}`,
        Date.now() - 300000, // Last 5 minutes
        Date.now()
      );
      
      if (recentFailures > 5) {
        // Alert security team
        await this.alertSecurityTeam(`Suspicious activity detected: ${clientId}`);
      }
    }
  }
}
```

---

## 🚨 Error Handling & Recovery

### Comprehensive Error Recovery System

```typescript
class ErrorRecoveryService {
  private db: Pool;
  private eventMonitor: BlockchainEventMonitor;
  private notificationService: NotificationService;

  async handleFailedEventProcessing(eventData: any, error: Error): Promise<void> {
    const client = await this.db.connect();
    
    try {
      // Record failed event
      const insertQuery = `
        INSERT INTO blockchain_events (
          event_type, transaction_hash, block_number, booking_id,
          event_data, processing_status, error_message, retry_count
        ) VALUES ($1, $2, $3, $4, $5, 'FAILED', $6, 1)
        ON CONFLICT (transaction_hash, log_index) 
        DO UPDATE SET 
          retry_count = blockchain_events.retry_count + 1,
          error_message = $6,
          processing_status = CASE 
            WHEN blockchain_events.retry_count >= 5 THEN 'DEAD_LETTER'
            ELSE 'RETRY'
          END
      `;
      
      await client.query(insertQuery, [
        eventData.eventType,
        eventData.transactionHash,
        eventData.blockNumber,
        eventData.bookingId,
        JSON.stringify(eventData),
        error.message
      ]);
      
      // Schedule retry if not at max attempts
      if (eventData.retryCount < 5) {
        await this.scheduleRetry(eventData, eventData.retryCount + 1);
      } else {
        // Move to dead letter queue and alert
        await this.handleDeadLetterEvent(eventData, error);
      }
      
    } catch (dbError) {
      console.error('🔴 Failed to record event processing error:', dbError);
    } finally {
      client.release();
    }
  }

  async reconcileBlockchainState(): Promise<void> {
    console.log('🔄 Starting blockchain state reconciliation...');
    
    const client = await this.db.connect();
    
    try {
      // Find bookings with mismatched states
      const mismatchQuery = `
        SELECT b.*, be.event_data
        FROM bookings b
        LEFT JOIN blockchain_events be ON b.blockchain_booking_id = be.booking_id
        WHERE 
          (b.status = 'PENDING_PAYMENT' AND be.event_type = 'BookingCreatedAndPaid') OR
          (b.status = 'PAID' AND be.event_type = 'ServiceCompleted') OR
          (b.status IN ('PAID', 'PENDING_COMPLETION') AND be.event_type = 'BookingCancelled')
      `;
      
      const mismatches = await client.query(mismatchQuery);
      
      for (const booking of mismatches.rows) {
        await this.reconcileBooking(booking);
      }
      
      // Find orphaned blockchain events
      const orphanQuery = `
        SELECT be.*
        FROM blockchain_events be
        LEFT JOIN bookings b ON be.booking_id = b.blockchain_booking_id
        WHERE b.id IS NULL AND be.event_type IN ('BookingCreatedAndPaid', 'ServiceCompleted')
      `;
      
      const orphans = await client.query(orphanQuery);
      
      for (const orphan of orphans.rows) {
        await this.handleOrphanedEvent(orphan);
      }
      
      console.log(`✅ Reconciliation complete: ${mismatches.rows.length} mismatches, ${orphans.rows.length} orphans`);
      
    } catch (error) {
      console.error('🔴 Reconciliation failed:', error);
    } finally {
      client.release();
    }
  }

  async handleTransactionFailure(
    bookingId: string,
    transactionType: 'payment' | 'completion' | 'cancellation',
    error: Error
  ): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update booking with failure information
      const updateQuery = `
        UPDATE bookings SET 
          blockchain_error = $1,
          blockchain_error_at = NOW(),
          retry_count = COALESCE(retry_count, 0) + 1
        WHERE blockchain_booking_id = $2
      `;
      
      await client.query(updateQuery, [error.message, bookingId]);
      
      // For payment failures, reset to PENDING_PAYMENT
      if (transactionType === 'payment') {
        await client.query(
          `UPDATE bookings SET status = 'PENDING_PAYMENT' WHERE blockchain_booking_id = $1`,
          [bookingId]
        );
      }
      
      await client.query('COMMIT');
      
      // Notify user of failure with retry option
      await this.notificationService.sendTransactionFailureNotification(
        bookingId,
        transactionType,
        error.message
      );
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      console.error('🔴 Failed to handle transaction failure:', dbError);
    } finally {
      client.release();
    }
  }

  // Emergency system shutdown procedure
  async emergencyShutdown(reason: string): Promise<void> {
    console.error(`🚨 EMERGENCY SHUTDOWN: ${reason}`);
    
    try {
      // Pause the smart contract if we have owner privileges
      const ownerWallet = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY!);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, ownerWallet);
      
      if (await contract.owner() === ownerWallet.address) {
        const tx = await contract.pause();
        await tx.wait();
        console.log('⏸️ Smart contract paused');
      }
      
      // Stop all event listeners
      await this.eventMonitor.stop();
      
      // Alert all stakeholders
      await this.notificationService.sendEmergencyAlert(reason);
      
      // Update system status
      await this.updateSystemStatus('EMERGENCY_SHUTDOWN', reason);
      
    } catch (error) {
      console.error('🔴 Emergency shutdown failed:', error);
    }
  }
}
```

---

## 🧪 Testing Strategy

### Integration Test Suite

```typescript
import { describe, it, beforeAll, afterAll } from '@jest/globals';
import { ethers } from 'ethers';

describe('Blockchain Integration Tests', () => {
  let provider: ethers.JsonRpcProvider;
  let contract: ethers.Contract;
  let testWallets: ethers.Wallet[];
  let signatureService: SignatureService;
  let eventProcessor: EventProcessor;

  beforeAll(async () => {
    // Setup test environment
    provider = new ethers.JsonRpcProvider(process.env.TEST_RPC_URL);
    
    // Deploy test contract or connect to testnet
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    
    // Create test wallets
    testWallets = [
      new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider),
      new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider),
      new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider)
    ];
    
    // Fund test wallets
    await fundTestWallets(testWallets);
    
    // Initialize services
    signatureService = new SignatureService(
      process.env.BACKEND_SIGNER_PRIVATE_KEY!,
      84532,
      CONTRACT_ADDRESS
    );
    
    eventProcessor = new EventProcessor();
  });

  describe('Booking Creation Flow', () => {
    it('should create booking authorization signature', async () => {
      const { authorization, signature } = await signatureService.generateBookingAuthorization({
        bookingId: 'test-booking-123',
        customer: testWallets[0].address,
        provider: testWallets[1].address,
        amount: 100,
        platformFeeRate: 1000,
        inviterFeeRate: 0
      });

      expect(authorization.customer).toBe(testWallets[0].address);
      expect(signature).toMatch(/^0x[0-9a-fA-F]{130}$/);
    });

    it('should create and pay booking on-chain', async () => {
      // Create database booking first
      const bookingId = await createTestBooking();
      
      // Generate authorization
      const { authorization, signature } = await signatureService.generateBookingAuthorization({
        bookingId,
        customer: testWallets[0].address,
        provider: testWallets[1].address,
        amount: 100,
        platformFeeRate: 1500,
        inviterFeeRate: 0
      });

      // Execute on-chain transaction
      const customerContract = contract.connect(testWallets[0]);
      const tx = await customerContract.createAndPayBooking(authorization, signature);
      const receipt = await tx.wait();

      expect(receipt.status).toBe(1);
      
      // Verify event emission
      const events = receipt.logs.map(log => contract.interface.parseLog(log));
      const bookingEvent = events.find(e => e?.name === 'BookingCreatedAndPaid');
      
      expect(bookingEvent).toBeDefined();
      expect(bookingEvent!.args.customer).toBe(testWallets[0].address);
    });

    it('should process BookingCreatedAndPaid event', async () => {
      // Mock event data
      const eventData = {
        eventType: 'BookingCreatedAndPaid',
        bookingId: ethers.keccak256(ethers.toUtf8Bytes('test-booking-123')),
        customer: testWallets[0].address,
        provider: testWallets[1].address,
        amount: ethers.parseUnits('100', 6).toString(),
        transactionHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
        blockNumber: 12345
      };

      await eventProcessor.processBookingCreatedPaid(eventData);

      // Verify database was updated
      const booking = await getBookingByBlockchainId(eventData.bookingId);
      expect(booking.status).toBe('PAID');
      expect(booking.blockchain_tx_hash).toBe(eventData.transactionHash);
    });
  });

  describe('Service Completion Flow', () => {
    it('should complete service and distribute payments', async () => {
      // Setup: Create and pay for booking
      const bookingId = await createAndPayTestBooking();
      
      // Complete service
      const customerContract = contract.connect(testWallets[0]);
      const tx = await customerContract.completeService(
        ethers.keccak256(ethers.toUtf8Bytes(bookingId))
      );
      
      const receipt = await tx.wait();
      
      // Verify event emission
      const events = receipt.logs.map(log => contract.interface.parseLog(log));
      const completionEvent = events.find(e => e?.name === 'ServiceCompleted');
      
      expect(completionEvent).toBeDefined();
      expect(completionEvent!.args.provider).toBe(testWallets[1].address);
    });
  });

  describe('Error Handling', () => {
    it('should handle orphaned blockchain events', async () => {
      const orphanEventData = {
        eventType: 'BookingCreatedAndPaid',
        bookingId: ethers.keccak256(ethers.toUtf8Bytes('non-existent-booking')),
        customer: testWallets[0].address,
        provider: testWallets[1].address,
        amount: ethers.parseUnits('100', 6).toString(),
        transactionHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
        blockNumber: 12346
      };

      // This should trigger emergency cancellation
      await eventProcessor.processBookingCreatedPaid(orphanEventData);

      // Verify emergency cancellation was called
      // (This would require mocking the emergency cancel function)
    });

    it('should retry failed event processing', async () => {
      // Mock database failure
      jest.spyOn(eventProcessor, 'processBookingCreatedPaid')
        .mockRejectedValueOnce(new Error('Database connection failed'))
        .mockResolvedValueOnce(undefined);

      const eventData = {
        eventType: 'BookingCreatedAndPaid',
        bookingId: 'test-retry-booking',
        retryCount: 0
      };

      await expect(eventProcessor.processBookingCreatedPaid(eventData)).rejects.toThrow();
      
      // Retry should succeed
      await expect(eventProcessor.processBookingCreatedPaid({
        ...eventData,
        retryCount: 1
      })).resolves.toBeUndefined();
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });
});
```

---

## 📊 Deployment & Monitoring

### Railway Deployment Configuration

Since the project uses Railway for deployment, the blockchain integration needs to work within Railway's constraints and utilize existing Railway services.

#### Railway-Specific Considerations

```typescript
// railway-blockchain-service.ts
// Service that integrates blockchain monitoring with existing Railway infrastructure

class RailwayBlockchainService {
  private eventMonitor: BlockchainEventMonitor;
  private specificMonitor: EventSpecificMonitor;
  private autoCompleteService: AutoCompleteService;

  constructor() {
    // Initialize with Railway environment variables
    this.eventMonitor = new BlockchainEventMonitor({
      providers: {
        primary: process.env.ALCHEMY_RPC_URL!,
        fallback: process.env.INFURA_RPC_URL!,
        backup: 'https://sepolia.base.org'
      },
      contractAddress: process.env.CONTRACT_ADDRESS!,
      startBlock: parseInt(process.env.START_BLOCK || '30740428'),
      batchSize: 50,
      retryConfig: {
        maxRetries: 3,
        backoffMs: 2000,
        exponential: true
      }
    });

    this.specificMonitor = new EventSpecificMonitor(
      new ethers.JsonRpcProvider('https://sepolia.base.org')
    );

    // Integration with existing auto-complete functionality
    this.autoCompleteService = new AutoCompleteService();
  }

  // Start blockchain services alongside existing Railway services
  async start(): Promise<void> {
    console.log('🚀 Starting Railway Blockchain Integration...');

    // Start event monitoring
    await this.eventMonitor.start();

    // Register with existing auto-complete system
    await this.registerBlockchainAutoComplete();

    console.log('✅ Railway Blockchain Integration started');
  }

  // Integrate with existing Railway cron auto-complete functionality
  private async registerBlockchainAutoComplete(): Promise<void> {
    // Hook into existing auto-complete system to check for blockchain completion
    this.autoCompleteService.registerCompletionCheck('blockchain', async (bookingId: string) => {
      const booking = await this.getBookingFromDB(bookingId);
      
      if (booking.status === 'PAID' && this.shouldAutoComplete(booking)) {
        // Trigger blockchain completion
        return await this.initiateBlockchainCompletion(booking);
      }
      
      return false;
    });
  }

  private async initiateBlockchainCompletion(booking: any): Promise<boolean> {
    try {
      // Start monitoring for ServiceCompleted event
      const monitorId = await this.specificMonitor.startMonitoring(
        'ServiceCompleted',
        {
          bookingId: booking.blockchain_booking_id,
          customer: booking.customer_wallet_address
        }
      );

      // Execute blockchain transaction (this would be called by customer/provider)
      // The monitoring will catch the event and update the database
      
      console.log(`📡 Started monitoring for auto-completion: ${booking.id}`);
      return true;
      
    } catch (error) {
      console.error(`🔴 Failed to initiate blockchain completion for ${booking.id}:`, error);
      return false;
    }
  }
}
```

#### Railway Environment Configuration

```bash
# Railway Environment Variables (set in Railway dashboard)

# Database (Railway provides)
DATABASE_URL=postgresql://... (Railway managed)
REDIS_URL=redis://... (Railway Redis addon)

# Blockchain Configuration  
CONTRACT_ADDRESS=0x33ddEd6F8183aa4dAB04E2aE216a5a3f9871405a
CHAIN_ID=84532
START_BLOCK=30740428

# RPC Providers
ALCHEMY_RPC_URL=wss://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY
INFURA_RPC_URL=wss://base-sepolia.infura.io/ws/v3/YOUR_PROJECT_ID

# Critical Security (use Railway's secret management)
BACKEND_SIGNER_PRIVATE_KEY=0xYOUR_BACKEND_SIGNER_PRIVATE_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY

# Existing Privy/Supabase (already configured)
PRIVY_APP_SECRET=...
SUPABASE_SERVICE_ROLE_KEY=...
```

#### Railway Cron Integration

```javascript
// Update existing Railway cron job to include blockchain awareness
// File: cron/auto-complete.js

const { RailwayBlockchainService } = require('../services/railway-blockchain-service');

class EnhancedAutoCompleteService {
  constructor() {
    this.blockchainService = new RailwayBlockchainService();
    this.traditionalAutoComplete = new TraditionalAutoComplete();
  }

  async runAutoComplete() {
    console.log('🔄 Running enhanced auto-complete with blockchain integration...');
    
    // Get bookings eligible for auto-completion
    const eligibleBookings = await this.getEligibleBookings();
    
    for (const booking of eligibleBookings) {
      try {
        if (booking.blockchain_booking_id) {
          // Blockchain-enabled booking
          await this.handleBlockchainAutoComplete(booking);
        } else {
          // Traditional booking (backward compatibility)
          await this.traditionalAutoComplete.completeBooking(booking);
        }
      } catch (error) {
        console.error(`🔴 Auto-complete failed for booking ${booking.id}:`, error);
      }
    }
  }

  async handleBlockchainAutoComplete(booking) {
    // Check if already completed on blockchain
    const blockchainStatus = await this.checkBlockchainStatus(booking);
    
    if (blockchainStatus === 'COMPLETED') {
      // Already completed on blockchain, just update our DB
      await this.syncCompletionFromBlockchain(booking);
    } else if (this.shouldTriggerAutoComplete(booking)) {
      // Initiate auto-completion through blockchain
      await this.blockchainService.initiateBlockchainCompletion(booking);
    }
  }

  shouldTriggerAutoComplete(booking) {
    // Existing logic for determining auto-completion eligibility
    const hoursElapsed = (Date.now() - new Date(booking.scheduled_at).getTime()) / (1000 * 60 * 60);
    return hoursElapsed >= 2; // Auto-complete 2 hours after scheduled time
  }
}

// Railway cron job entry point
module.exports = async () => {
  const autoComplete = new EnhancedAutoCompleteService();
  await autoComplete.runAutoComplete();
};
```

#### Railway Deployment Structure

```
bookme/
├── src/                          # Main application
├── backend/                      # Hono backend
├── contracts/                    # Smart contracts
├── services/
│   ├── blockchain/              # New blockchain services
│   │   ├── event-monitor.ts     # Event monitoring
│   │   ├── signature-service.ts # EIP-712 signatures
│   │   └── railway-integration.ts # Railway-specific integration
│   └── auto-complete/           # Enhanced auto-complete
│       └── blockchain-aware.ts  # Blockchain-aware auto-complete
├── cron/                        # Railway cron jobs
│   └── enhanced-auto-complete.js # Updated cron job
├── railway.toml                 # Railway configuration
└── package.json                # Updated with blockchain dependencies
```

#### Updated Railway Configuration

```toml
# railway.toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm run start:production"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3

[environments.production.variables]
NODE_ENV = "production"
CONTRACT_ADDRESS = "0x33ddEd6F8183aa4dAB04E2aE216a5a3f9871405a"
CHAIN_ID = "84532"

[environments.production.plugins]
postgresql = {}
redis = {}

# Cron jobs
[[environments.production.crons]]
command = "node cron/enhanced-auto-complete.js"
schedule = "*/30 * * * *"  # Every 30 minutes

[[environments.production.crons]]  
command = "node cron/blockchain-reconciliation.js"
schedule = "0 */6 * * *"   # Every 6 hours - reconcile blockchain state
```

### Monitoring & Alerting Setup

```typescript
// monitoring/metrics.ts
import { createPrometheusMetrics } from 'prom-client';

class BlockchainMetrics {
  private eventProcessingCounter: Counter;
  private transactionSuccessRate: Gauge;
  private eventProcessingDuration: Histogram;
  private blockchainSyncLag: Gauge;

  constructor() {
    this.eventProcessingCounter = new Counter({
      name: 'blockchain_events_processed_total',
      help: 'Total number of blockchain events processed',
      labelNames: ['event_type', 'status']
    });

    this.transactionSuccessRate = new Gauge({
      name: 'blockchain_transaction_success_rate',
      help: 'Success rate of blockchain transactions',
      labelNames: ['transaction_type']
    });

    this.eventProcessingDuration = new Histogram({
      name: 'blockchain_event_processing_duration_seconds',
      help: 'Time taken to process blockchain events',
      labelNames: ['event_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10]
    });

    this.blockchainSyncLag = new Gauge({
      name: 'blockchain_sync_lag_blocks',
      help: 'Number of blocks behind current blockchain height'
    });
  }

  recordEventProcessed(eventType: string, status: 'success' | 'failed'): void {
    this.eventProcessingCounter.inc({ event_type: eventType, status });
  }

  recordTransactionResult(transactionType: string, success: boolean): void {
    const currentRate = this.transactionSuccessRate.get({ transaction_type: transactionType })?.value || 0;
    const newRate = success ? Math.min(currentRate + 0.1, 1) : Math.max(currentRate - 0.1, 0);
    this.transactionSuccessRate.set({ transaction_type: transactionType }, newRate);
  }

  recordEventProcessingTime(eventType: string, durationSeconds: number): void {
    this.eventProcessingDuration.observe({ event_type: eventType }, durationSeconds);
  }

  updateSyncLag(lagBlocks: number): void {
    this.blockchainSyncLag.set(lagBlocks);
  }
}

// Alert definitions
const alertRules = {
  eventProcessingFailureRate: {
    condition: 'rate(blockchain_events_processed_total{status="failed"}[5m]) > 0.1',
    message: 'High event processing failure rate detected',
    severity: 'critical'
  },
  
  transactionFailureRate: {
    condition: 'blockchain_transaction_success_rate < 0.95',
    message: 'Transaction success rate below threshold',
    severity: 'warning'
  },
  
  syncLag: {
    condition: 'blockchain_sync_lag_blocks > 10',
    message: 'Blockchain sync lagging behind',
    severity: 'warning'
  },
  
  eventProcessingDelay: {
    condition: 'rate(blockchain_event_processing_duration_seconds_sum[5m]) > 30',
    message: 'Event processing taking too long',
    severity: 'critical'
  }
};
```

### Health Check Endpoints

```typescript
// Health check system
class HealthCheckService {
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    const checks = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      blockchain: await this.checkBlockchainConnection(),
      eventProcessing: await this.checkEventProcessing(),
      smartContract: await this.checkSmartContract()
    };

    const failedChecks = Object.entries(checks).filter(([_, status]) => !status.healthy);
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (failedChecks.length > 0) {
      const criticalFailures = failedChecks.filter(([_, status]) => status.critical);
      overallStatus = criticalFailures.length > 0 ? 'unhealthy' : 'degraded';
    }

    return {
      status: overallStatus,
      details: checks
    };
  }

  private async checkBlockchainConnection(): Promise<{ healthy: boolean; critical: boolean; details: any }> {
    try {
      const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_RPC_URL);
      const blockNumber = await provider.getBlockNumber();
      const blockAge = Date.now() - (await provider.getBlock(blockNumber))!.timestamp * 1000;
      
      return {
        healthy: blockAge < 300000, // Less than 5 minutes old
        critical: true,
        details: { blockNumber, blockAge }
      };
    } catch (error) {
      return {
        healthy: false,
        critical: true,
        details: { error: error.message }
      };
    }
  }

  private async checkSmartContract(): Promise<{ healthy: boolean; critical: boolean; details: any }> {
    try {
      const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_RPC_URL);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
      
      const [owner, paused] = await Promise.all([
        contract.owner(),
        contract.paused()
      ]);
      
      return {
        healthy: !paused,
        critical: true,
        details: { owner, paused, address: CONTRACT_ADDRESS }
      };
    } catch (error) {
      return {
        healthy: false,
        critical: true,
        details: { error: error.message }
      };
    }
  }
}

// Express health check endpoint
app.get('/health', async (req, res) => {
  const healthCheck = new HealthCheckService();
  const health = await healthCheck.getHealthStatus();
  
  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json(health);
});
```

---

## 📝 Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Set up blockchain event monitoring infrastructure
- [ ] Extend database schema with blockchain fields
- [ ] Implement signature generation service
- [ ] Create basic smart contract service class
- [ ] Set up Redis for event processing queues

### Phase 2: Core Integration (Week 2)
- [ ] Implement booking creation and payment flow
- [ ] Build event processing workers
- [ ] Add frontend transaction handling components
- [ ] Create transaction status tracking
- [ ] Implement basic error handling

### Phase 3: Advanced Features (Week 3)
- [ ] Add service completion flow
- [ ] Implement cancellation mechanisms
- [ ] Build comprehensive error recovery system
- [ ] Add monitoring and alerting
- [ ] Create admin tools for manual intervention

### Phase 4: Testing & Production (Week 4)
- [ ] Comprehensive integration testing
- [ ] Load testing and performance optimization
- [ ] Security audit and penetration testing
- [ ] Production deployment setup
- [ ] Documentation and training materials

---

**Document Version:** 1.0  
**Last Updated:** September 7, 2025  
**Implementation Target:** Q4 2025

*This technical implementation guide provides the foundation for full blockchain integration of the BookMe platform.*