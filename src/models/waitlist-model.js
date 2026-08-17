import mongoose from "mongoose";

const waitlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    regNo: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    Session: { type: String, required: true, trim: true },
    bookTitle: { type: String, required: true, trim: true },
    bookAuthors: [{ type: String, trim: true }],
    notified: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

waitlistSchema.index({ book: 1, isActive: 1, createdAt: 1 });
waitlistSchema.index({ user: 1, isActive: 1 });
waitlistSchema.index(
  { user: 1, book: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

export const Waitlist = mongoose.model("Waitlist", waitlistSchema);