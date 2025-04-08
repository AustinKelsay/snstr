import { NostrEvent } from '../types/nostr';

// Event kinds defined in NIP-47
export enum NIP47EventKind {
  INFO = 13194,
  REQUEST = 23194,
  RESPONSE = 23195,
  NOTIFICATION = 23196
}

// Methods defined in NIP-47
export enum NIP47Method {
  GET_INFO = 'get_info',
  GET_BALANCE = 'get_balance',
  PAY_INVOICE = 'pay_invoice',
  MAKE_INVOICE = 'make_invoice',
  LOOKUP_INVOICE = 'lookup_invoice',
  LIST_TRANSACTIONS = 'list_transactions',
  SIGN_MESSAGE = 'sign_message',
  
  // Extended methods (not in the NIP-47 standard)
  PAY_KEYSEND = 'pay_keysend',
  MULTI_PAY_INVOICE = 'multi_pay_invoice',
  MULTI_PAY_KEYSEND = 'multi_pay_keysend'
}

// NIP-47 notification types
export enum NIP47NotificationType {
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_SENT = 'payment_sent'
}

// NIP-47 error categories for better organization
export enum NIP47ErrorCategory {
  AUTHORIZATION = 'AUTHORIZATION',   // Permission/authentication errors
  VALIDATION = 'VALIDATION',         // Input validation errors
  RESOURCE = 'RESOURCE',             // Resource availability errors 
  NETWORK = 'NETWORK',               // Network/communication errors
  WALLET = 'WALLET',                 // Wallet-specific errors
  TIMEOUT = 'TIMEOUT',               // Timeout-related errors
  INTERNAL = 'INTERNAL'              // Internal/system errors
}

// NIP-47 error codes
export enum NIP47ErrorCode {
  // Standard NIP-47 error codes (from spec)
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  INVOICE_EXPIRED = 'INVOICE_EXPIRED',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  
  // Request expiration (mentioned in spec)
  REQUEST_EXPIRED = 'REQUEST_EXPIRED',
  
  // Extended error codes (implementation-specific)
  TIMEOUT = 'TIMEOUT',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  RELAY_ERROR = 'RELAY_ERROR',
  PUBLISH_FAILED = 'PUBLISH_FAILED',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  DECRYPTION_ERROR = 'DECRYPTION_ERROR',
  UNAUTHORIZED_CLIENT = 'UNAUTHORIZED_CLIENT',
  
  // More granular validation errors
  INVALID_INVOICE_FORMAT = 'INVALID_INVOICE_FORMAT',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  
  // More granular payment errors
  PAYMENT_ROUTE_NOT_FOUND = 'PAYMENT_ROUTE_NOT_FOUND',
  PAYMENT_REJECTED = 'PAYMENT_REJECTED',
  
  // More granular wallet errors
  WALLET_LOCKED = 'WALLET_LOCKED',
  WALLET_UNAVAILABLE = 'WALLET_UNAVAILABLE'
}

// Error code to category mapping
export const ERROR_CATEGORIES: Record<string, NIP47ErrorCategory> = {
  [NIP47ErrorCode.UNAUTHORIZED]: NIP47ErrorCategory.AUTHORIZATION,
  [NIP47ErrorCode.UNAUTHORIZED_CLIENT]: NIP47ErrorCategory.AUTHORIZATION,
  
  [NIP47ErrorCode.INVALID_REQUEST]: NIP47ErrorCategory.VALIDATION,
  [NIP47ErrorCode.INVALID_INVOICE_FORMAT]: NIP47ErrorCategory.VALIDATION,
  [NIP47ErrorCode.INVALID_AMOUNT]: NIP47ErrorCategory.VALIDATION,
  [NIP47ErrorCode.INVALID_PARAMETER]: NIP47ErrorCategory.VALIDATION,
  
  [NIP47ErrorCode.INSUFFICIENT_BALANCE]: NIP47ErrorCategory.RESOURCE,
  [NIP47ErrorCode.NOT_FOUND]: NIP47ErrorCategory.RESOURCE,
  [NIP47ErrorCode.WALLET_UNAVAILABLE]: NIP47ErrorCategory.RESOURCE,
  
  [NIP47ErrorCode.PAYMENT_FAILED]: NIP47ErrorCategory.WALLET,
  [NIP47ErrorCode.PAYMENT_ROUTE_NOT_FOUND]: NIP47ErrorCategory.WALLET,
  [NIP47ErrorCode.PAYMENT_REJECTED]: NIP47ErrorCategory.WALLET,
  [NIP47ErrorCode.INVOICE_EXPIRED]: NIP47ErrorCategory.WALLET,
  [NIP47ErrorCode.WALLET_LOCKED]: NIP47ErrorCategory.WALLET,
  
  [NIP47ErrorCode.TIMEOUT]: NIP47ErrorCategory.TIMEOUT,
  [NIP47ErrorCode.REQUEST_EXPIRED]: NIP47ErrorCategory.TIMEOUT,
  
  [NIP47ErrorCode.CONNECTION_ERROR]: NIP47ErrorCategory.NETWORK,
  [NIP47ErrorCode.RELAY_ERROR]: NIP47ErrorCategory.NETWORK,
  [NIP47ErrorCode.PUBLISH_FAILED]: NIP47ErrorCategory.NETWORK,
  [NIP47ErrorCode.ENCRYPTION_ERROR]: NIP47ErrorCategory.NETWORK,
  [NIP47ErrorCode.DECRYPTION_ERROR]: NIP47ErrorCategory.NETWORK,
  
  [NIP47ErrorCode.INTERNAL_ERROR]: NIP47ErrorCategory.INTERNAL
};

// Recovery hints for error codes
export const ERROR_RECOVERY_HINTS: Record<string, string> = {
  [NIP47ErrorCode.UNAUTHORIZED]: 'Check connection credentials and permissions',
  [NIP47ErrorCode.UNAUTHORIZED_CLIENT]: 'This client is not authorized. Contact wallet administrator',
  [NIP47ErrorCode.INVALID_REQUEST]: 'Check request parameters and try again',
  [NIP47ErrorCode.INSUFFICIENT_BALANCE]: 'Add funds to your wallet and try again',
  [NIP47ErrorCode.PAYMENT_FAILED]: 'Payment could not be processed. Try again later',
  [NIP47ErrorCode.INVOICE_EXPIRED]: 'Request a new invoice and try again',
  [NIP47ErrorCode.NOT_FOUND]: 'The requested resource was not found',
  [NIP47ErrorCode.INTERNAL_ERROR]: 'An internal error occurred. Please report this issue',
  [NIP47ErrorCode.REQUEST_EXPIRED]: 'Request timed out. Try again with a longer expiration time',
  [NIP47ErrorCode.TIMEOUT]: 'Operation timed out. Check connection and try again',
  [NIP47ErrorCode.CONNECTION_ERROR]: 'Could not connect to the relay. Check network and relay status',
  [NIP47ErrorCode.RELAY_ERROR]: 'Error communicating with relay. Try a different relay',
  [NIP47ErrorCode.PUBLISH_FAILED]: 'Failed to publish event to relay. Try again or use a different relay',
  [NIP47ErrorCode.ENCRYPTION_ERROR]: 'Encryption error. Check encryption parameters',
  [NIP47ErrorCode.DECRYPTION_ERROR]: 'Decryption error. Check if using correct keys',
  [NIP47ErrorCode.INVALID_INVOICE_FORMAT]: 'Invoice format is invalid. Check the invoice',
  [NIP47ErrorCode.INVALID_AMOUNT]: 'Amount is invalid. Must be a positive integer',
  [NIP47ErrorCode.INVALID_PARAMETER]: 'One or more parameters are invalid',
  [NIP47ErrorCode.PAYMENT_ROUTE_NOT_FOUND]: 'No route found to destination. Try a different recipient or amount',
  [NIP47ErrorCode.PAYMENT_REJECTED]: 'Payment was rejected by recipient node',
  [NIP47ErrorCode.WALLET_LOCKED]: 'Wallet is locked. Unlock wallet and try again',
  [NIP47ErrorCode.WALLET_UNAVAILABLE]: 'Wallet is currently unavailable. Try again later'
};

// Transaction types
export enum TransactionType {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing'
}

// Connection options for NIP-47
export interface NIP47ConnectionOptions {
  /**
   * Public key of the wallet service
   */
  pubkey: string;
  
  /**
   * Secret value for authentication (typically a private key)
   */
  secret: string;
  
  /**
   * List of relay URLs
   */
  relays: string[];
}

// Base request interface
export interface NIP47Request {
  method: string;
  params: Record<string, any>;
}

// NIP-47 error (extended with more fields)
export interface NIP47Error {
  code: string;
  message: string;
  category?: string;
  recoveryHint?: string;
  data?: any; // Additional data relevant to the error
}

// Base response interface
export interface NIP47Response {
  result_type: string;
  result: any | null;
  error: NIP47Error | null; // Must be null for successful responses, not undefined
}

// Base notification interface
export interface NIP47Notification {
  notification_type: string;
  notification: Record<string, any>;
}

// Transaction interface for list_transactions and notifications
export interface NIP47Transaction {
  type: TransactionType;
  invoice?: string;
  description?: string;
  description_hash?: string;
  preimage?: string;
  payment_hash: string;
  amount: number;
  fees_paid: number;
  created_at: number;
  expires_at?: number;
  settled_at?: number;
  metadata?: Record<string, any>;
}

// Method-specific request interfaces
export interface GetInfoRequest extends NIP47Request {
  method: NIP47Method.GET_INFO;
  params: {};
}

export interface GetBalanceRequest extends NIP47Request {
  method: NIP47Method.GET_BALANCE;
  params: {};
}

export interface PayInvoiceRequest extends NIP47Request {
  method: NIP47Method.PAY_INVOICE;
  params: {
    invoice: string;
    amount?: number;
    maxfee?: number;
  };
}

export interface MakeInvoiceRequest extends NIP47Request {
  method: NIP47Method.MAKE_INVOICE;
  params: {
    amount: number;
    description: string;
    description_hash?: string;
    expiry?: number;
  };
}

export interface LookupInvoiceRequest extends NIP47Request {
  method: NIP47Method.LOOKUP_INVOICE;
  params: {
    payment_hash?: string;
    invoice?: string;
  };
}

export interface ListTransactionsRequest extends NIP47Request {
  method: NIP47Method.LIST_TRANSACTIONS;
  params: {
    from?: number;
    until?: number;
    limit?: number;
    offset?: number;
    unpaid?: boolean;
    type?: string;
  };
}

export interface SignMessageRequest extends NIP47Request {
  method: NIP47Method.SIGN_MESSAGE;
  params: {
    message: string;
  };
}

// Method-specific response interfaces
export interface GetInfoResponse extends NIP47Response {
  result_type: NIP47Method.GET_INFO;
  result: {
    alias?: string;
    color?: string;
    pubkey?: string;
    network?: string;
    block_height?: number;
    block_hash?: string;
    methods: string[];
    notifications?: string[];
  } | null;
  error: NIP47Error | null;
}

export interface GetBalanceResponse extends NIP47Response {
  result_type: NIP47Method.GET_BALANCE;
  result: number | null;
  error: NIP47Error | null;
}

export interface PayInvoiceResponse extends NIP47Response {
  result_type: NIP47Method.PAY_INVOICE;
  result: {
    preimage: string;
    payment_hash: string;
    amount: number;
    fees_paid: number;
  } | null;
  error: NIP47Error | null;
}

export interface MakeInvoiceResponse extends NIP47Response {
  result_type: NIP47Method.MAKE_INVOICE;
  result: {
    invoice: string;
    payment_hash: string;
    amount: number;
    created_at: number;
    expires_at?: number;
  } | null;
  error: NIP47Error | null;
}

export interface LookupInvoiceResponse extends NIP47Response {
  result_type: NIP47Method.LOOKUP_INVOICE;
  result: NIP47Transaction | null;
  error: NIP47Error | null;
}

export interface ListTransactionsResponse extends NIP47Response {
  result_type: NIP47Method.LIST_TRANSACTIONS;
  result: {
    transactions: NIP47Transaction[];
  } | null;
  error: NIP47Error | null;
}

export interface SignMessageResponse extends NIP47Response {
  result_type: NIP47Method.SIGN_MESSAGE;
  result: {
    message: string;
    signature: string;
  } | null;
  error: NIP47Error | null;
}

// Notification interfaces
export interface PaymentReceivedNotification extends NIP47Notification {
  notification_type: NIP47NotificationType.PAYMENT_RECEIVED;
  notification: NIP47Transaction;
}

export interface PaymentSentNotification extends NIP47Notification {
  notification_type: NIP47NotificationType.PAYMENT_SENT;
  notification: NIP47Transaction;
}

// Wallet implementation interface
export interface WalletImplementation {
  getInfo(): Promise<any>;
  getBalance(): Promise<number>;
  payInvoice(invoice: string, amount?: number, maxfee?: number): Promise<any>;
  makeInvoice(amount: number, description: string, description_hash?: string, expiry?: number): Promise<any>;
  lookupInvoice(paymentHash?: string, invoice?: string): Promise<NIP47Transaction>;
  listTransactions(from?: number, until?: number, limit?: number, offset?: number, unpaid?: boolean, type?: string): Promise<NIP47Transaction[]>;
  signMessage?(message: string): Promise<{signature: string, message: string}>;
} 