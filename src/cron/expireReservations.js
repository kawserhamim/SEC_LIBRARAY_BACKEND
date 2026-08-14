import cron from "node-cron";

import { Book } from "../models/book-model.js";
import { ReserveBook } from "../models/reserve-book.js";
import User from "../models/user-auth-models.js";
import { enqueueWaitlistAvailability } from "../queues/waitlist-queue.js";

// =====================================================
// EXPIRE RESERVATIONS CRON JOB
// Runs every minute.
// For every reservation that is:
//   - status = "pending"
//   - expiresAt <= now
// We do:
//   1. Mark it as "expired"
//   2. Increase the book's availableCopies by 1
//   3. Add 20 to that user's fine
// =====================================================

const EXPIRY_FINE = 20;

const expireReservations = async () => {
  try {
    const now = new Date();

    // ---------------------------------------------
    // Find all pending reservations that are expired
    // ---------------------------------------------

    const expiredReservations =
      await ReserveBook.find({
        status: "pending",
        expiresAt: { $lte: now },
      });

    if (expiredReservations.length === 0) {
      return;
    }

    console.log(
      `[expireReservations] Found ${expiredReservations.length} expired reservation(s)`,
    );

    // ---------------------------------------------
    // Loop through each expired reservation
    // ---------------------------------------------

    for (const reservation of expiredReservations) {
      try {
        // 1. Increase book availableCopies by 1
        const book = await Book.findById(reservation.book);

        if (!book) {
          // Book not found — still mark reservation as expired below.
          await ReserveBook.updateOne(
            { _id: reservation._id },
            { $set: { status: "expired" } },
          );
          continue;
        }

        // Only add a copy back if we still have room.
        let copyReturned = false;
        if (book.availableCopies < book.totalCopies) {
          book.availableCopies += 1;
          await book.save();
          copyReturned = true;
        }

        // 2. Add 20 to the user's fine
        await User.updateOne(
          { _id: reservation.user },
          { $inc: { fine: EXPIRY_FINE } },
        );

        // 3. Mark reservation as expired
        await ReserveBook.updateOne(
          { _id: reservation._id },
          { $set: { status: "expired" } },
        );

        // 4. Enqueue a waitlist-availability job so the
        //    in-process queue can fan-out notifications
        //    to as many oldest waitlisters as there are
        //    newly available copies (here: 1).
        if (copyReturned) {
          const enqueued = enqueueWaitlistAvailability(
            book._id,
            1,
          );

          if (!enqueued) {
            console.log(
              `[expireReservations] Waitlist notification for book ${book._id} already queued or running`,
            );
          }
        }

        console.log(
          `[expireReservations] Expired reservation ${reservation.reservedId} for user ${reservation.user_regNo}`,
        );
      } catch (innerError) {
        console.error(
          `[expireReservations] Error processing reservation ${reservation.reservedId}:`,
          innerError,
        );
      }
    }
  } catch (error) {
    console.error(
      "[expireReservations] Cron job error:",
      error,
    );
  }
};

export const startExpireReservationsCron = () => {
  // Every minute
  cron.schedule(
    "* * * * *",
    () => {
      expireReservations();
    },
    {
      scheduled: true,
    },
  );

  console.log(
    "[expireReservations] Cron job scheduled (runs every minute)",
  );
};

export default expireReservations;