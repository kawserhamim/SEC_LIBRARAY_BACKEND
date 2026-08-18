import "dotenv/config";
import app from "./src/app.js";
import { connectDB } from "./src/config/db.js";
import { testRedisConnection } from "./src/config/redis.js";
import { startExpireReservationsCron } from "./src/cron/expireReservations.js";
import { startOverdueIssuedBooksCron } from "./src/cron/overdueIssuedBooks.js";
import { startRetryStuckEnrichmentsCron } from "./src/cron/retryStuckEnrichments.js";
import { startWaitlistQueue } from "./src/queues/waitlist-queue.js";
import { startEnrichmentQueue } from "./src/queues/enrichment-queue.js";

async function bootstrap() {
  await connectDB();

  const redisOk = await testRedisConnection();
  if (!redisOk) {
    throw new Error("Redis connection check failed");
  }

  // Start in-process queue & cron jobs
  startWaitlistQueue();
  startExpireReservationsCron();
  startOverdueIssuedBooksCron();

  // Book AI enrichment is a value-add feature, not core to the library
  // system — never let a missing/broken Groq/Redis-TCP config crash startup.
  try {
    startEnrichmentQueue();
    startRetryStuckEnrichmentsCron();
  } catch (error) {
    console.error("[bootstrap] Book enrichment failed to start (continuing without it):", error.message);
  }

  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Application failed to start:", error);
  process.exit(1);
});