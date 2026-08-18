import { Queue, Worker } from "bullmq";
import { createQueueRedisConnection, isQueueRedisConfigured } from "../config/queue-redis.js";
import { enrichBook } from "../services/book-enrichment-service.js";

const QUEUE_NAME = "book-enrichment";
const DEFAULT_CONCURRENCY = 2; // kept low to respect Groq's free-tier rate limit
const JOB_ATTEMPTS = 2; // BullMQ-level retries for infra failures only —
// enrichBook() already retries invalid LLM output internally (ENRICHMENT_MAX_ATTEMPTS)
const JOB_BACKOFF_MS = 5000;

let queue = null;
let worker = null;

export function enqueueBookEnrichment(bookId) {
  if (!queue) {
    console.warn(`[enrichment-queue] Queue not running; skipping enrichment for book ${bookId}`);
    return false;
  }

  queue.add(
    "enrich",
    { bookId: String(bookId) },
    {
      attempts: JOB_ATTEMPTS,
      backoff: { type: "exponential", delay: JOB_BACKOFF_MS },
      removeOnComplete: true,
      removeOnFail: 1000,
    }
  );
  return true;
}

// Non-fatal by design: book enrichment is a value-add feature, not core to
// the library system. A missing/broken Redis TCP connection or Groq key
// must never prevent the API from starting or block book CRUD.
export function startEnrichmentQueue(options = {}) {
  if (!isQueueRedisConfigured()) {
    console.warn("[enrichment-queue] REDIS_TCP_URL not set; book enrichment is disabled");
    return;
  }

  try {
    queue = new Queue(QUEUE_NAME, { connection: createQueueRedisConnection() });

    worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        await enrichBook(job.data.bookId);
      },
      {
        connection: createQueueRedisConnection(),
        concurrency: options.concurrency ?? DEFAULT_CONCURRENCY,
      }
    );

    worker.on("failed", (job, error) => {
      console.error(`[enrichment-queue] Job failed for book ${job?.data?.bookId}:`, error.message);
    });

    console.log(`[enrichment-queue] Started (concurrency=${options.concurrency ?? DEFAULT_CONCURRENCY})`);
  } catch (error) {
    console.error("[enrichment-queue] Failed to start; book enrichment is disabled:", error.message);
    queue = null;
    worker = null;
  }
}

export async function shutdownEnrichmentQueue() {
  await worker?.close();
  await queue?.close();
}

export function isEnrichmentQueueRunning() {
  return Boolean(queue);
}
