import cron from "node-cron";
import { IssuedBook } from "../models/issuebook-model.js";

const markOverdueIssuedBooks = async () => {
  try {
    const overdueBooks = await IssuedBook.find({
      status: "borrowed",
      dueDate: { $lte: new Date() },
    }).select("_id issuedId");

    if (overdueBooks.length === 0) return;

    console.log(`[markOverdueIssuedBooks] Found ${overdueBooks.length} overdue issued book(s)`);

    for (const issued of overdueBooks) {
      try {
        const updated = await IssuedBook.updateOne(
          { _id: issued._id, status: "borrowed" },
          { $set: { status: "overdue" } }
        );

        if (updated.modifiedCount > 0) {
          console.log(`[markOverdueIssuedBooks] Marked overdue: ${issued.issuedId}`);
        }
      } catch (innerError) {
        console.error(
          `[markOverdueIssuedBooks] Error processing issued book ${issued.issuedId}:`,
          innerError
        );
      }
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