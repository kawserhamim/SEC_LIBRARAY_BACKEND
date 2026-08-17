import cron from "node-cron";

import { IssuedBook } from "../models/issuebook-model.js";

// =====================================================
// OVERDUE ISSUED BOOKS CRON JOB
// Runs every minute.
// For every IssuedBook that is:
//   - status = "borrowed"
//   - dueDate <= now
//   - returnedAt is null (defensive)
// We do:
//   1. Mark it as "overdue"
//
// We do NOT auto-return overdue books, do NOT change
// availableCopies, and do NOT change any fine. The
// admin decides when to actually mark them returned.
// =====================================================

const markOverdueIssuedBooks = async () => {
  try {
    const now = new Date();

    // ---------------------------------------------
    // Find all currently-borrowed books whose dueDate
    // has passed.
    // ---------------------------------------------
    const overdueBooks = await IssuedBook.find({
      status: "borrowed",
      dueDate: { $lte: now },
    }).select("_id issuedId dueDate user book");

    if (overdueBooks.length === 0) {
      return;
    }

    console.log(
      `[markOverdueIssuedBooks] Found ${overdueBooks.length} overdue issued book(s)`,
    );

    for (const issued of overdueBooks) {
      try {
        const updated = await IssuedBook.updateOne(
          { _id: issued._id, status: "borrowed" },
          { $set: { status: "overdue" } },
        );

        if (updated.modifiedCount > 0) {
          console.log(
            `[markOverdueIssuedBooks] Marked overdue: ${issued.issuedId}`,
          );
        }
      } catch (innerError) {
        console.error(
          `[markOverdueIssuedBooks] Error processing issued book ${issued.issuedId}:`,
          innerError,
        );
      }
    }
  } catch (error) {
    console.error(
      "[markOverdueIssuedBooks] Cron job error:",
      error,
    );
  }
};

export const startOverdueIssuedBooksCron = () => {
  // Every minute
  cron.schedule(
    "* * * * *",
    () => {
      markOverdueIssuedBooks();
    },
    {
      scheduled: true,
    },
  );

  console.log(
    "[markOverdueIssuedBooks] Cron job scheduled (runs every minute)",
  );
};

export default markOverdueIssuedBooks;