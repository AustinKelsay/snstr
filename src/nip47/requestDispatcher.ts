import {
  ERROR_CATEGORIES,
  ERROR_RECOVERY_HINTS,
  ListTransactionsParams,
  LookupInvoiceParams,
  MakeInvoiceParams,
  NIP47EncryptionScheme,
  NIP47ErrorCode,
  NIP47Method,
  NIP47Request,
  NIP47Response,
  NIP47ResponseResult,
  PayInvoiceParams,
  SignMessageParams,
  WalletImplementation,
} from "./types";

export interface NIP47RequestDispatcherOptions {
  wallet: WalletImplementation;
  supportedMethods: readonly NIP47Method[];
  supportedEncryption: readonly NIP47EncryptionScheme[];
}

function errorResponse(
  method: NIP47Method,
  code: NIP47ErrorCode,
  message: string,
  data?: Record<string, unknown>,
): NIP47Response {
  return {
    result_type: method,
    result: null,
    error: {
      code,
      message,
      category: ERROR_CATEGORIES[code],
      recoveryHint: ERROR_RECOVERY_HINTS[code],
      data,
    },
  };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export async function dispatchNIP47Request(
  request: NIP47Request,
  options: NIP47RequestDispatcherOptions,
): Promise<NIP47Response> {
  const { wallet, supportedMethods, supportedEncryption } = options;
  if (!supportedMethods.includes(request.method)) {
    return errorResponse(
      request.method,
      NIP47ErrorCode.INVALID_REQUEST,
      `Method ${request.method} not supported`,
    );
  }

  const invalid = (message: string) =>
    errorResponse(request.method, NIP47ErrorCode.INVALID_REQUEST, message);

  try {
    let result: NIP47ResponseResult;
    switch (request.method) {
      case NIP47Method.GET_INFO:
        result = {
          ...(await wallet.getInfo()),
          encryption: [...supportedEncryption],
        };
        break;
      case NIP47Method.GET_BALANCE:
        result = await wallet.getBalance();
        break;
      case NIP47Method.PAY_INVOICE: {
        const params = request.params as PayInvoiceParams;
        if (
          !isObject(params) ||
          typeof params.invoice !== "string" ||
          (params.amount !== undefined && typeof params.amount !== "number") ||
          (params.maxfee !== undefined && typeof params.maxfee !== "number")
        )
          return invalid("Invalid parameters for pay_invoice method");
        result = await wallet.payInvoice(
          params.invoice,
          params.amount,
          params.maxfee,
        );
        break;
      }
      case NIP47Method.MAKE_INVOICE: {
        const params = request.params as MakeInvoiceParams;
        if (
          !isObject(params) ||
          typeof params.amount !== "number" ||
          (params.description !== undefined &&
            typeof params.description !== "string") ||
          (params.description_hash !== undefined &&
            typeof params.description_hash !== "string") ||
          (params.expiry !== undefined && typeof params.expiry !== "number")
        )
          return invalid("Invalid parameters for make_invoice method");
        result = await wallet.makeInvoice(
          params.amount,
          params.description,
          params.description_hash,
          params.expiry,
        );
        break;
      }
      case NIP47Method.LOOKUP_INVOICE: {
        const params = request.params as LookupInvoiceParams;
        if (
          !isObject(params) ||
          (params.payment_hash !== undefined &&
            typeof params.payment_hash !== "string") ||
          (params.invoice !== undefined &&
            typeof params.invoice !== "string") ||
          (typeof params.payment_hash !== "string" &&
            typeof params.invoice !== "string")
        )
          return invalid("Invalid parameters for lookup_invoice method");
        try {
          result = await wallet.lookupInvoice({
            payment_hash: params.payment_hash,
            invoice: params.invoice,
          });
        } catch (error) {
          const known = error as { code?: NIP47ErrorCode; message?: string };
          if (known.code !== NIP47ErrorCode.NOT_FOUND) throw error;
          const lookupType = params.payment_hash ? "payment_hash" : "invoice";
          const lookupValue = params.payment_hash || params.invoice;
          return errorResponse(
            request.method,
            NIP47ErrorCode.NOT_FOUND,
            `Invoice not found: Could not find ${lookupType}: ${lookupValue} in the wallet's database`,
          );
        }
        break;
      }
      case NIP47Method.LIST_TRANSACTIONS: {
        const params = request.params as ListTransactionsParams;
        if (
          !isObject(params) ||
          (params.from !== undefined && typeof params.from !== "number") ||
          (params.until !== undefined && typeof params.until !== "number") ||
          (params.limit !== undefined && typeof params.limit !== "number") ||
          (params.offset !== undefined && typeof params.offset !== "number") ||
          (params.unpaid !== undefined && typeof params.unpaid !== "boolean") ||
          (params.type !== undefined && typeof params.type !== "string")
        )
          return invalid("Invalid parameters for list_transactions method");
        result = {
          transactions: await wallet.listTransactions(
            params.from,
            params.until,
            params.limit,
            params.offset,
            params.unpaid,
            params.type,
          ),
        };
        break;
      }
      case NIP47Method.SIGN_MESSAGE: {
        const params = request.params as SignMessageParams;
        if (!isObject(params) || typeof params.message !== "string") {
          return invalid("Invalid parameters for sign_message method");
        }
        if (!wallet.signMessage) {
          return invalid("sign_message method not implemented by wallet");
        }
        result = await wallet.signMessage(params.message);
        break;
      }
      default:
        return invalid(`Method ${request.method} not supported`);
    }
    return { result_type: request.method, result, error: null };
  } catch (error) {
    const known = error as {
      code?: NIP47ErrorCode;
      message?: string;
      data?: Record<string, unknown>;
    };
    return errorResponse(
      request.method,
      known.code || NIP47ErrorCode.INTERNAL_ERROR,
      known.message || "An error occurred processing the request",
      known.data,
    );
  }
}
