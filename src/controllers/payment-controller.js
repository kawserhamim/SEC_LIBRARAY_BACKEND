import { handleAuthError } from "../utils/handle-auth-error.js";
import {
  initFinePayment,
  handleIpnValidation,
  getMyPaymentHistory,
  getMyPaymentStatus,
} from "../services/payment-service.js";

export const initPaymentHandler = async (req, res) => {
  try {
    const result = await initFinePayment(req.user);
    return res.status(200).json({
      success: true,
      message: "Payment session created",
      data: result,
    });
  } catch (error) {
    return handleAuthError(res, error, "initPayment");
  }
};

// SSLCommerz only cares that this responds; it does not read the body/status.
// Errors are logged, never surfaced, so a transient failure doesn't make
// SSLCommerz think the IPN URL is broken and stop retrying.
export const ipnHandler = async (req, res) => {
  try {
    await handleIpnValidation(req.body);
  } catch (error) {
    console.error("sslcommerz IPN handling failed:", error);
  }
  return res.status(200).send("IPN received");
};

const buildRedirectHandler = (status) => (req, res) => {
  const tran_id = req.body?.tran_id || req.query?.tran_id || "";
  const studentClientUrl = process.env.STUDENT_CLIENT_URL || "";
  const redirectUrl = `${studentClientUrl}/fine/payment-result?status=${status}&tran_id=${encodeURIComponent(tran_id)}`;
  return res.redirect(303, redirectUrl);
};

// UX-only redirects — SSLCommerz POSTs these from the customer's browser,
// which can be replayed/forged, so they never touch the fine balance
// themselves. The frontend re-checks the real status via myPaymentStatusHandler.
export const paymentSuccessHandler = buildRedirectHandler("success");
export const paymentFailHandler = buildRedirectHandler("fail");
export const paymentCancelHandler = buildRedirectHandler("cancel");

export const myPaymentHistoryHandler = async (req, res) => {
  try {
    const result = await getMyPaymentHistory(req.user.id, req.query);
    return res.status(200).json({
      success: true,
      message: result.transactions.length > 0 ? "Payment history found" : "No payments yet",
      ...result,
    });
  } catch (error) {
    return handleAuthError(res, error, "myPaymentHistory");
  }
};

export const myPaymentStatusHandler = async (req, res) => {
  try {
    const { tran_id } = req.params;
    const transaction = await getMyPaymentStatus(req.user.id, tran_id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }
    return res.status(200).json({ success: true, message: "Transaction found", data: transaction });
  } catch (error) {
    return handleAuthError(res, error, "myPaymentStatus");
  }
};
