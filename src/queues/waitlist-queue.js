// =====================================================
// WAITLIST NOTIFICATION QUEUE
//
// In-process async queue for "a book just freed up,
// notify every waitlister for it" jobs.
//
// Why an in-process queue?
//   - This project removed bullmq / Redis-backed queues
//   - We still need: ordering, concurrency control,
//     retries, graceful shutdown
//   - All producers and consumers live in the same
//     Node process so an in-memory queue is enough.
//
// Features:
//   - Configurable concurrency (default 4)
//   - Per-job retry with exponential backoff
//   - Coalesces duplicate bookIds enqueued while a
//     job for that book is already pending or running
//   - Graceful shutdown that waits for in-flight jobs
// =====================================================

const DEFAULT_CONCURRENCY = 4;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 500;

// pending: jobs that have not started yet, mapped
//   bookId -> availableCopies to fan out when the
//   job finally runs.
// running: jobs currently being processed, same shape.
// Coalescing rule: if a producer enqueues the same
//   bookId again while one is pending/running, the new
//   availableCopies value is ADDED to the existing
//   bucket so the worker fans out the total count.
const pending = new Map(); // bookId -> availableCopies
const running = new Map(); // bookId -> availableCopies

let concurrency = DEFAULT_CONCURRENCY;
let maxRetries = DEFAULT_MAX_RETRIES;
let baseDelayMs = DEFAULT_BASE_DELAY_MS;

let shuttingDown = false;

// =====================================================
// ENQUEUE
// Adds `availableCopies` for `bookId`. If a job for
// this book is already pending or running, the new
// copies are added to that bucket (coalesce by sum).
// Returns true if a fresh job was created,
// false if the bookId was already pending/running.
// =====================================================

export function enqueueWaitlistAvailability(bookId, availableCopies = 1) {
  if (!bookId) return false;

  if (shuttingDown) {
    console.warn(
      "[waitlist-queue] Refusing to enqueue; queue is shutting down",
    );
    return false;
  }

  const key = String(bookId);
  const copies = Math.max(1, Number(availableCopies) || 1);

  // Coalesce: add the new copies to the existing
  // pending or running bucket for this book.
  if (pending.has(key)) {
    pending.set(key, pending.get(key) + copies);
    return false;
  }

  if (running.has(key)) {
    running.set(key, running.get(key) + copies);
    return false;
  }

  pending.set(key, copies);

  // Kick off scheduling on next tick so the caller
  // is not blocked by job processing.
  setImmediate(pump);

  return true;
}

// =====================================================
// PUMP
// Pulls up to `concurrency` jobs from pending and
// runs them. Called whenever a job is enqueued or
// a running job finishes.
// =====================================================

function pump() {
  if (shuttingDown) return;

  while (running.size < concurrency && pending.size > 0) {
    const iterator = pending.entries().next();
    const bookId = iterator.value[0];
    const availableCopies = iterator.value[1];

    pending.delete(bookId);
    running.set(bookId, availableCopies);

    // Fire-and-forget; runJob handles retries itself.
    runJob(bookId, availableCopies).finally(() => {
      running.delete(bookId);
      // If more jobs arrived while we were running,
      // schedule the next pump.
      if (pending.size > 0) {
        setImmediate(pump);
      }
    });
  }
}

// =====================================================
// RUN A SINGLE JOB
// Dynamically imports the worker so the queue file
// does not pull in Mongoose at module load.
// =====================================================

async function runJob(bookId, availableCopies) {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      // Lazy import to avoid circular deps and keep
      // this queue file framework-light.
      const worker = await import(
        "../services/waitlist-notification-worker.js"
      );

      const result = await worker.processWaitlistAvailability(
        bookId,
        availableCopies,
      );

      console.log(
        `[waitlist-queue] Notified ${result?.notifiedCount ?? 0} waitlister(s) for book ${bookId} (${availableCopies} copy/copies available)`,
      );
      return;
    } catch (error) {
      attempt += 1;

      if (attempt > maxRetries) {
        console.error(
          `[waitlist-queue] Giving up on book ${bookId} after ${maxRetries} retries:`,
          error?.message || error,
        );
        return;
      }

      // Exponential backoff: 500ms, 1000ms, 2000ms, ...
      const delay = baseDelayMs * 2 ** (attempt - 1);

      console.warn(
        `[waitlist-queue] Attempt ${attempt} failed for book ${bookId}; retrying in ${delay}ms`,
        error?.message || error,
      );

      await sleep(delay);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =====================================================
// START (called once at boot)
// =====================================================

export function startWaitlistQueue(options = {}) {
  concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;

  console.log(
    `[waitlist-queue] Started (concurrency=${concurrency}, maxRetries=${maxRetries})`,
  );
}

// =====================================================
// GRACEFUL SHUTDOWN
// Stops accepting new jobs and waits for running ones.
// =====================================================

export async function shutdownWaitlistQueue() {
  shuttingDown = true;

  // Wait for running jobs to finish (with a soft timeout)
  const deadline = Date.now() + 30_000;

  while (running.size > 0 && Date.now() < deadline) {
    await sleep(100);
  }

  console.log(
    `[waitlist-queue] Shutdown complete (pending=${pending.size}, running=${running.size})`,
  );
}

// =====================================================
// INTERNAL ACCESSORS (for tests / diagnostics)
// =====================================================

export function _getQueueStats() {
  return {
    pending: pending.size,
    running: running.size,
    concurrency,
    shuttingDown,
  };
}
