export interface LnurlSuccessAction {
  /** Type of success action */
  tag: string;
  /** Action message */
  message?: string;
  /** URL to visit after payment */
  url?: string;
  /** Description of the action */
  description?: string;
  /** CDATA for the action */
  cdata?: string;
}

export interface LnurlInvoiceResponse {
  pr: string;
  payment_hash?: string;
  successAction?: LnurlSuccessAction;
  status?: string;
  reason?: string;
}
