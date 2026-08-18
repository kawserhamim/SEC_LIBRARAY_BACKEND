import cron from "node-cron";
import { Book } from "../models/book-model.js";
import { enqueueBookEnrichment, isEnrichmentQueueRunning } from "../queues/enrichment-queue.js";

const STUCK_TIMEOUT_MS = Number(process.env.ENRICHMENT_STUCK_TIMEOUT_MS) || 10 * 60 * 1000; // 10 min
const MAX_ATTEMPTS = Number(process.env.ENRICHMENT_MAX_ATTEMPTS) || 3;

const retryStuckEnrichments = async () => {
  if (!isEnrichmentQueueRunning()) return; // enrichment disabled — nothing to retry

  try {
    const cutoff = new Date(Date.now() - STUCK_TIMEOUT_MS);

    const stuckBooks = await Book.find({
      $or: [
        { "aiEnrichment.status": { $in: ["pending", "processing"] }, "aiEnrichment.statusUpdatedAt": { $lte: cutoff } },
        { "aiEnrichment.status": "failed", "aiEnrichment.attempts": { $lt: MAX_ATTEMPTS } },
      ],
    }).select("_id");

    if (stuckBooks.length === 0) return;

    console.log(`[retryStuckEnrichments] Re-enqueuing ${stuckBooks.length} book(s)`);

    for (const book of stuckBooks) {
      enqueueBookEnrichment(book._id);
    }
  } catch (error) {
    console.error("[retryStuckEnrichments] Cron job error:", error);
  }
};

export const startRetryStuckEnrichmentsCron = () => {
  cron.schedule("*/5 * * * *", retryStuckEnrichments, { scheduled: true });
  console.log("[retryStuckEnrichments] Cron job scheduled (runs every 5 minutes)");
};

export default retryStuckEnrichments;
