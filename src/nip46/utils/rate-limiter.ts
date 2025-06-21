/**
 * Rate limiting system for NIP-46 to prevent DoS attacks
 */

export interface RateLimitConfig {
  maxRequestsPerMinute?: number;
  maxRequestsPerHour?: number;
  burstSize?: number;
  cleanupIntervalMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // seconds until next request allowed
  remainingRequests?: number;
}

interface ClientRequestHistory {
  requests: number[]; // timestamps in seconds
  lastCleanup: number;
}

export class NIP46RateLimiter {
  private readonly maxRequestsPerMinute: number;
  private readonly maxRequestsPerHour: number;
  private readonly burstSize: number;
  private readonly cleanupIntervalMs: number;
  
  private clientHistory = new Map<string, ClientRequestHistory>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimitConfig = {}) {
    this.maxRequestsPerMinute = config.maxRequestsPerMinute ?? 60;
    this.maxRequestsPerHour = config.maxRequestsPerHour ?? 1000;
    this.burstSize = config.burstSize ?? 10;
    this.cleanupIntervalMs = config.cleanupIntervalMs ?? 300000; // 5 minutes

    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Check if a request is allowed for the given client
   */
  isAllowed(clientPubkey: string): RateLimitResult {
    const now = Math.floor(Date.now() / 1000);
    const history = this.getOrCreateHistory(clientPubkey, now);
    
    // Clean old requests from history
    this.cleanHistory(history, now);
    
    // Check burst limit (requests in last 10 seconds)
    const burstWindow = now - 10;
    const recentRequests = history.requests.filter(timestamp => timestamp >= burstWindow);
    
    if (recentRequests.length >= this.burstSize) {
      return {
        allowed: false,
        retryAfter: 10,
        remainingRequests: 0
      };
    }
    
    // Check per-minute limit
    const minuteWindow = now - 60;
    const minuteRequests = history.requests.filter(timestamp => timestamp >= minuteWindow);
    
    if (minuteRequests.length >= this.maxRequestsPerMinute) {
      const oldestRequest = Math.min(...minuteRequests);
      const retryAfter = 60 - (now - oldestRequest);
      return {
        allowed: false,
        retryAfter: Math.max(1, retryAfter),
        remainingRequests: 0
      };
    }
    
    // Check per-hour limit
    const hourWindow = now - 3600;
    const hourRequests = history.requests.filter(timestamp => timestamp >= hourWindow);
    
    if (hourRequests.length >= this.maxRequestsPerHour) {
      const oldestRequest = Math.min(...hourRequests);
      const retryAfter = 3600 - (now - oldestRequest);
      return {
        allowed: false,
        retryAfter: Math.max(1, retryAfter),
        remainingRequests: 0
      };
    }
    
    // Request is allowed - record it
    history.requests.push(now);
    
    return {
      allowed: true,
      remainingRequests: Math.min(
        this.maxRequestsPerMinute - minuteRequests.length - 1,
        this.maxRequestsPerHour - hourRequests.length - 1,
        this.burstSize - recentRequests.length - 1
      )
    };
  }

  /**
   * Get remaining requests for a client (for informational purposes)
   */
  getRemainingRequests(clientPubkey: string): { minute: number; hour: number; burst: number } {
    const now = Math.floor(Date.now() / 1000);
    const history = this.clientHistory.get(clientPubkey);
    
    if (!history) {
      return {
        minute: this.maxRequestsPerMinute,
        hour: this.maxRequestsPerHour,
        burst: this.burstSize
      };
    }
    
    this.cleanHistory(history, now);
    
    const minuteWindow = now - 60;
    const hourWindow = now - 3600;
    const burstWindow = now - 10;
    
    const minuteRequests = history.requests.filter(timestamp => timestamp >= minuteWindow).length;
    const hourRequests = history.requests.filter(timestamp => timestamp >= hourWindow).length;
    const burstRequests = history.requests.filter(timestamp => timestamp >= burstWindow).length;
    
    return {
      minute: Math.max(0, this.maxRequestsPerMinute - minuteRequests),
      hour: Math.max(0, this.maxRequestsPerHour - hourRequests),
      burst: Math.max(0, this.burstSize - burstRequests)
    };
  }

  /**
   * Clear rate limiting history for a client (for testing or admin purposes)
   */
  clearClient(clientPubkey: string): void {
    this.clientHistory.delete(clientPubkey);
  }

  /**
   * Clear all rate limiting history
   */
  clearAll(): void {
    this.clientHistory.clear();
  }

  /**
   * Get or create history for a client
   */
  private getOrCreateHistory(clientPubkey: string, now: number): ClientRequestHistory {
    let history = this.clientHistory.get(clientPubkey);
    
    if (!history) {
      history = {
        requests: [],
        lastCleanup: now
      };
      this.clientHistory.set(clientPubkey, history);
    }
    
    return history;
  }

  /**
   * Clean old requests from history
   */
  private cleanHistory(history: ClientRequestHistory, now: number): void {
    // Only clean if it's been more than a minute since last cleanup
    if (now - history.lastCleanup < 60) {
      return;
    }
    
    // Keep only requests from the last hour
    const hourWindow = now - 3600;
    history.requests = history.requests.filter(timestamp => timestamp >= hourWindow);
    history.lastCleanup = now;
  }

  /**
   * Start cleanup interval to prevent memory leaks
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.cleanupIntervalMs).unref(); // Don't keep process alive
  }

  /**
   * Perform periodic cleanup of old data
   */
  private performCleanup(): void {
    const now = Math.floor(Date.now() / 1000);
    const hourWindow = now - 3600;
    const clientsToDelete: string[] = [];
    
    // First pass: clean history and collect clients to delete
    for (const [clientPubkey, history] of this.clientHistory.entries()) {
      // Remove requests older than 1 hour
      history.requests = history.requests.filter(timestamp => timestamp >= hourWindow);
      
      // Mark clients with no recent requests for deletion
      if (history.requests.length === 0 && now - history.lastCleanup > 3600) {
        clientsToDelete.push(clientPubkey);
      }
    }
    
    // Second pass: delete marked clients to avoid concurrent modification
    for (const clientPubkey of clientsToDelete) {
      this.clientHistory.delete(clientPubkey);
    }
  }

  /**
   * Stop the rate limiter and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clientHistory.clear();
  }

  /**
   * Get statistics about current rate limiting state
   */
  getStats(): {
    totalClients: number;
    totalRequests: number;
    oldestRequest: number | null;
    newestRequest: number | null;
  } {
    let totalRequests = 0;
    let oldestRequest: number | null = null;
    let newestRequest: number | null = null;
    
    for (const history of this.clientHistory.values()) {
      totalRequests += history.requests.length;
      
      for (const timestamp of history.requests) {
        if (oldestRequest === null || timestamp < oldestRequest) {
          oldestRequest = timestamp;
        }
        if (newestRequest === null || timestamp > newestRequest) {
          newestRequest = timestamp;
        }
      }
    }
    
    return {
      totalClients: this.clientHistory.size,
      totalRequests,
      oldestRequest,
      newestRequest
    };
  }
} 