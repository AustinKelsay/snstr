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
  SIGN_MESSAGE = 'sign_message'
}

// NIP-47 notification types
export enum NIP47NotificationType {
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_SENT = 'payment_sent'
}

// NIP-47 error codes
export enum NIP47ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  INVOICE_EXPIRED = 'INVOICE_EXPIRED',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

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

// NIP-47 error
export interface NIP47Error {
  code: string;
  message: string;
}

// Base response interface
export interface NIP47Response {
  result_type: string;
  result?: any;
  error?: NIP47Error;
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
  error?: NIP47Error;
}

export interface GetBalanceResponse extends NIP47Response {
  result_type: NIP47Method.GET_BALANCE;
  result: number | null;
  error?: NIP47Error;
}

export interface PayInvoiceResponse extends NIP47Response {
  result_type: NIP47Method.PAY_INVOICE;
  result: {
    preimage: string;
    payment_hash: string;
    amount: number;
    fees_paid: number;
  } | null;
  error?: NIP47Error;
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
  error?: NIP47Error;
}

export interface LookupInvoiceResponse extends NIP47Response {
  result_type: NIP47Method.LOOKUP_INVOICE;
  result: NIP47Transaction | null;
  error?: NIP47Error;
}

export interface ListTransactionsResponse extends NIP47Response {
  result_type: NIP47Method.LIST_TRANSACTIONS;
  result: {
    transactions: NIP47Transaction[];
  } | null;
  error?: NIP47Error;
}

export interface SignMessageResponse extends NIP47Response {
  result_type: NIP47Method.SIGN_MESSAGE;
  result: {
    message: string;
    signature: string;
  } | null;
  error?: NIP47Error;
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