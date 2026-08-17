const DEFAULT_CONCURRENCY = 4;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 500;

const pending = new Map(); // bookId -> availableCopies
const running = new Map(); // bookId -> availableCopies

let concurrency = DEFAULT_CONCURRENCY;
let maxRetries = DEFAULT_MAX_RETRIES;
let baseDelayMs = DEFAULT_BASE_DELAY_MS;
let shuttingDown = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runJob(bookId, availableCopies) {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const worker = await import("../services/waitlist-notification-worker.js");
      const result = await worker.processWaitlistAvailability(bookId, availableCopies);

      console.log(
        `[waitlist-queue] Notified ${result?.notifiedCount ?? 0} waitlister(s) for book ${bookId} (${availableCopies} copy/copies available)`
      );
      return;
    } catch (error) {
      attempt += 1;
      if (attempt > maxRetries) {
        console.error(
          `[waitlist-queue] Giving up on book ${bookId} after ${maxRetries} retries:`,
          error?.message || error
        );
        return;
      }

      const delay = baseDelayMs * 2 ** (attempt - 1);
      console.warn(
        `[waitlist-queue] Attempt ${attempt} failed for book ${bookId}; retrying in ${delay}ms`,
        error?.message || error
      );
      await sleep(delay);
    }
  }
}

function pump() {
  if (shuttingDown) return;

  while (running.size < concurrency && pending.size > 0) {
    const iterator = pending.entries().next();
    const [bookId, availableCopies] = iterator.value;

    pending.delete(bookId);
    running.set(bookId, availableCopies);

    runJob(bookId, availableCopies).finally(() => {
      running.delete(bookId);
      if (pending.size > 0) setImmediate(pump);
    });
  }
}

export function enqueueWaitlistAvailability(bookId, availableCopies = 1) {
  if (!bookId) return false;
  if (shuttingDown) {
    console.warn("[waitlist-queue] Refusing to enqueue; queue is shutting down");
    return false;
  }

  const key = String(bookId);
  const copies = Math.max(1, Number(availableCopies) || 1);

  if (pending.has(key)) {
    pending.set(key, pending.get(key) + copies);
    return false;
  }

  if (running.has(key)) {
    running.set(key, running.get(key) + copies);
    return false;
  }

  pending.set(key, copies);
  setImmediate(pump);
  return true;
}

export function startWaitlistQueue(options = {}) {
  concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;

  console.log(
    `[waitlist-queue] Started (concurrency=${concurrency}, maxRetries=${maxRetries})`
  );
}

export async function shutdownWaitlistQueue() {
  shuttingDown = true;
  const deadline = Date.now() + 30_000;

  while (running.size > 0 && Date.now() < deadline) {
    await sleep(100);
  }

  console.log(
    `[waitlist-queue] Shutdown complete (pending=${pending.size}, running=${running.size})`
  );
}

export function _getQueueStats() {
  return {
    pending: pending.size,
    running: running.size,
    concurrency,
    shuttingDown,
  };
}
