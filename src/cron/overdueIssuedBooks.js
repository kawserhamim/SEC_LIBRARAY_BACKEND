/**
 * Background Cron Job: Flag Overdue Issued Books
 * 
 * Flow:
 * 1. Checks for books with status 'borrowed' whose dueDate is in the past.
 * 2. Updates their status to 'overdue'.
 */

import cron from "node-cron";
import { IssuedBook } from "../models/issuebook-model.js";
import { broadcastOverdueStats } from "../services/socket-service.js";

const markOverdueIssuedBooks = async () => {
  try {
    const overdueBooks = await IssuedBook.find({
      status: "borrowed",
      dueDate: { $lte: new Date() },
    }).select("_id issuedId");

    if (overdueBooks.length === 0) return;

    console.log(`[markOverdueIssuedBooks] Found ${overdueBooks.length} overdue issued book(s)`);

    let modified = false;
    for (const issued of overdueBooks) {
      try {
        const updated = await IssuedBook.updateOne(
          { _id: issued._id, status: "borrowed" },
          { $set: { status: "overdue" } }
        );

        if (updated.modifiedCount > 0) {
          modified = true;
          console.log(`[markOverdueIssuedBooks] Marked overdue: ${issued.issuedId}`);
        }
      } catch (innerError) {
        console.error(
          `[markOverdueIssuedBooks] Error processing issued book ${issued.issuedId}:`,
          innerError
        );
      }
    }

    if (modified) {
      await broadcastOverdueStats();
    }
  } catch (error) {
    console.error("[markOverdueIssuedBooks] Cron job error:", error);
  }
};

export const startOverdueIssuedBooksCron = () => {
  cron.schedule("* * * * *", markOverdueIssuedBooks, { scheduled: true });
  console.log("[markOverdueIssuedBooks] Cron job scheduled (runs every minute)");
};

export default markOverdueIssuedBooks;