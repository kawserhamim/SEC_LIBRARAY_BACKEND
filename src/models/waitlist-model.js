import mongoose from "mongoose";

const waitlistSchema = new mongoose.Schema(
  {
    // ==============================
    // Main references
    // ==============================

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

    // ==============================
    // Student information snapshot
    // ==============================

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    regNo: {
      type: String,
      required: true,
      trim: true,
    },

    department: {
      type: String,
      required: true,
      trim: true,
    },

    season: {
      type: String,
      required: true,
      trim: true,
    },

    // ==============================
    // Book information snapshot
    // ==============================

    bookTitle: {
      type: String,
      required: true,
      trim: true,
    },

    // Multiple authors
    bookAuthors: [
      {
        type: String,
        trim: true,
      },
    ],

    // ==============================
    // Waitlist status
    // ==============================

    notified: {
      type: Boolean,
      default: false,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// ==============================
// Indexes
// ==============================

// Find active waitlist users for a book
waitlistSchema.index({
  book: 1,
  isActive: 1,
  createdAt: 1,
});

// Find user's active waitlists
waitlistSchema.index({
  user: 1,
  isActive: 1,
});

// Prevent duplicate active waitlist
waitlistSchema.index(
  {
    user: 1,
    book: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      isActive: true,
    },
  },
);

export const Waitlist = mongoose.model(
  "Waitlist",
  waitlistSchema,
);