import "dotenv/config";

import app from "./src/app.js";
import { connectDB } from "./src/config/db.js";
import "./src/config/redis.js";
import { startExpireReservationsCron } from "./src/cron/expireReservations.js";
import { startWaitlistQueue } from "./src/queues/waitlist-queue.js";

async function bootstrap() {
  await connectDB();

  // Start the in-process waitlist notification queue
  // (concurrency, retries, coalescing).
  startWaitlistQueue();

  // Start the cron job that expires pending reservations every minute.
  startExpireReservationsCron();

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