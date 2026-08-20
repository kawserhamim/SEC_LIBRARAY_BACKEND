import crypto from "node:crypto";
import User from "../models/user-auth-models.js";
import { Transaction } from "../models/transaction-model.js";
import { sslcz } from "../config/sslcommerz.js";
import { createFineClearedNotification } from "./notification-service.js";

const CURRENCY = "BDT";

export async function initFinePayment(reqUser) {
  const user = await User.findById(reqUser.id).select("name regNo email phone fine").lean();

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  if (!user.fine || user.fine <= 0) {
    const error = new Error("No outstanding fine to pay");
    error.statusCode = 400;
    throw error;
  }

  const backendUrl = process.env.BACKEND_URL;
  const tran_id = `FINE-${crypto.randomUUID()}`;
  const amount = user.fine;

  const transaction = await Transaction.create({
    user: user._id,
    userName: user.name,
    userRegNo: user.regNo,
    tran_id,
    amount,
    currency: CURRENCY,
    status: "PENDING",
  });

  const initData = {
    total_amount: amount,
    currency: CURRENCY,
    tran_id,
    success_url: `${backendUrl}/api/payment/sslcommerz/success`,
    fail_url: `${backendUrl}/api/payment/sslcommerz/fail`,
    cancel_url: `${backendUrl}/api/payment/sslcommerz/cancel`,
    ipn_url: `${backendUrl}/api/payment/sslcommerz/ipn`,
    shipping_method: "NO",
    product_name: "Library Fine Clearance",
    product_category: "Library Fine",
    product_profile: "general",
    cus_name: user.name,
    cus_email: user.email,
    cus_add1: "Sylhet Engineering College",
    cus_city: "Sylhet",
    cus_state: "Sylhet",
    cus_postcode: "3100",
    cus_country: "Bangladesh",
    cus_phone: user.phone || "N/A",
  };

  const apiResponse = await sslcz.init(initData);

  if (!apiResponse?.GatewayPageURL) {
    transaction.status = "FAILED";
    transaction.gatewayResponse = apiResponse;
    await transaction.save();

    const error = new Error("Failed to initiate payment gateway session");
    error.statusCode = 502;
    throw error;
  }

  return { gatewayUrl: apiResponse.GatewayPageURL, tran_id, amount };
}

// Only trusted entry point for clearing a fine. Never trust the raw IPN/redirect
// POST body directly — always re-verify with SSLCommerz's own validation API
// before touching the user's fine, since the browser-facing redirect and the
// unauthenticated IPN body can both be spoofed by anyone who can guess a tran_id.
export async function handleIpnValidation(body) {
  const { val_id, tran_id } = body || {};
  if (!val_id || !tran_id) return;

  const transaction = await Transaction.findOne({ tran_id }).lean();
  if (!transaction) return;
  if (transaction.status === "VALID") return;

  const validation = await sslcz.validate({ val_id });

  const isValid =
    (validation?.status === "VALID" || validation?.status === "VALIDATED") &&
    validation?.tran_id === tran_id &&
    Number(validation?.amount) === transaction.amount &&
    validation?.currency === transaction.currency;

  if (!isValid) {
    await Transaction.updateOne(
      { tran_id, status: { $ne: "VALID" } },
      {
        $set: {
          val_id,
          gatewayResponse: validation,
          status: validation?.status === "FAILED" ? "FAILED" : transaction.status,
        },
      }
    );
    return;
  }

  // Atomic claim: only one concurrent IPN delivery for this tran_id can win
  // the transition out of PENDING, so a duplicate/replayed IPN can't double-apply.
  const claimed = await Transaction.findOneAndUpdate(
    { tran_id, status: { $ne: "VALID" } },
    { $set: { status: "VALID", val_id, gatewayResponse: validation } },
    { new: true }
  );

  if (!claimed) return;

  // Atomic, pipeline-based update: clamps at 0 and never collides with the
  // cron job's concurrent $inc on the same fine field.
  const updatedUser = await User.findOneAndUpdate(
    { _id: claimed.user },
    [{ $set: { fine: { $max: [{ $subtract: [{ $ifNull: ["$fine", 0] }, claimed.amount] }, 0] } } }],
    { new: true }
  );

  if (updatedUser) {
    await createFineClearedNotification({
      userId: updatedUser._id,
      userName: updatedUser.name,
      userRegNo: updatedUser.regNo,
      amount: claimed.amount,
    });
  }
}

export async function getMyPaymentHistory(userId, query = {}) {
  const offset = Number.parseInt(query.offset ?? "0", 10);
  const limit = Math.min(Number.parseInt(query.limit ?? "20", 10), 100);

  const [totalCount, transactions] = await Promise.all([
    Transaction.countDocuments({ user: userId }),
    Transaction.find({ user: userId }).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
  ]);

  return { transactions, totalCount, offset, limit };
}

export async function getMyPaymentStatus(userId, tran_id) {
  return Transaction.findOne({ user: userId, tran_id }).lean();
}

export async function getAllPaymentsForAdmin(query = {}) {
  const offset = Number.parseInt(query.offset ?? "0", 10);
  const limit = Math.min(Number.parseInt(query.limit ?? "20", 10), 100);
  const { regNo, status } = query;

  const filter = {};
  if (regNo) filter.userRegNo = String(regNo).trim();
  if (status) filter.status = status;

  const [totalCount, transactions] = await Promise.all([
    Transaction.countDocuments(filter),
    Transaction.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
  ]);

  return { transactions, totalCount, offset, limit };
}
