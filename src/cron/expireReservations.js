import cron from "node-cron";
import { Book } from "../models/book-model.js";
import { ReserveBook } from "../models/reserve-book.js";
import User from "../models/user-auth-models.js";
import { enqueueWaitlistAvailability } from "../queues/waitlist-queue.js";

const EXPIRY_FINE = 20;

const expireReservations = async () => {
  try {
    const expiredReservations = await ReserveBook.find({
      status: "pending",
      expiresAt: { $lte: new Date() },
    });

    if (expiredReservations.length === 0) return;

    console.log(`[expireReservations] Found ${expiredReservations.length} expired reservation(s)`);

    for (const reservation of expiredReservations) {
      try {
        const book = await Book.findById(reservation.book);

        if (!book) {
          await ReserveBook.updateOne({ _id: reservation._id }, { $set: { status: "expired" } });
          continue;
        }

        let copyReturned = false;
        if (book.availableCopies < book.totalCopies) {
          book.availableCopies += 1;
          await book.save();
          copyReturned = true;
        }

        await User.updateOne({ _id: reservation.user }, { $inc: { fine: EXPIRY_FINE } });
        await ReserveBook.updateOne({ _id: reservation._id }, { $set: { status: "expired" } });

        if (copyReturned) {
          enqueueWaitlistAvailability(book._id, 1);
        }

        console.log(
          `[expireReservations] Expired reservation ${reservation.reservedId} for user ${reservation.user_regNo}`
        );
      } catch (innerError) {
        console.error(
          `[expireReservations] Error processing reservation ${reservation.reservedId}:`,
          innerError
        );
      }
    }
  } catch (error) {
    console.error("[expireReservations] Cron job error:", error);
  }
};

export const startExpireReservationsCron = () => {
  cron.schedule("* * * * *", expireReservations, { scheduled: true });
  console.log("[expireReservations] Cron job scheduled (runs every minute)");
};

export default expireReservations;