import "dotenv/config";

import app from "./src/app.js";
import { connectDB } from "./src/config/db.js";
import { testRedisConnection } from "./src/config/redis.js";
import { startExpireReservationsCron } from "./src/cron/expireReservations.js";
import { startOverdueIssuedBooksCron } from "./src/cron/overdueIssuedBooks.js";
import { startWaitlistQueue } from "./src/queues/waitlist-queue.js";

async function bootstrap() {
  await connectDB();

  const redisOk = await testRedisConnection();
  if (!redisOk) {
    throw new Error("Redis connection check failed");
  }

  // Start the in-process waitlist notification queue
  // (concurrency, retries, coalescing).
  startWaitlistQueue();

  // Start the cron job that expires pending reservations every minute.
  startExpireReservationsCron();

  // Start the cron job that marks overdue issued books every minute.
  startOverdueIssuedBooksCron();

  app.listen(process.env.PORT, () => {
    console.log(
      `API running on http://localhost:${process.env.PORT}`
    );
  });
}

bootstrap().catch((error) => {
  console.error(
    "Application failed to start:",
    error
  );

  process.exit(1);
});