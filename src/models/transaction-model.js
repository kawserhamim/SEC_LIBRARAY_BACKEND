import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userName: { type: String, trim: true, default: null },
    userRegNo: { type: String, trim: true, default: null, index: true },
    tran_id: { type: String, required: true, unique: true, index: true },
    val_id: { type: String, default: null },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "BDT" },
    status: {
      type: String,
      required: true,
      enum: ["PENDING", "VALID", "FAILED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    gatewayResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    // Separate from `status` so a VALID transaction whose fine-decrement step
    // failed (crash, transient DB error, etc.) can be safely retried later
    // without re-validating with SSLCommerz or risking a double-decrement.
    fineApplied: { type: Boolean, default: false },
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1, createdAt: -1 });

export const Transaction = mongoose.model("Transaction", transactionSchema);
