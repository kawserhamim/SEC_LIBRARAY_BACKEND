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

  // Start in-process queue & cron jobs
  startWaitlistQueue();
  startExpireReservationsCron();
  startOverdueIssuedBooksCron();

  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Application failed to start:", error);
  process.exit(1);
});