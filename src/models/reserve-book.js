import mongoose from "mongoose";

const RESERVATION_DURATION_HOURS = 2;

const reserveBookSchema = new mongoose.Schema(
  {
    // Which book
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: [true, "Book is required"],
      index: true,
    },

    // Book title snapshot
    book_title: {
      type: String,
      required: true,
      trim: true,
    },

    // Multiple authors
    book_authors: [
      {
        type: String,
        trim: true,
      },
    ],

    // Which user
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      index: true,
    },

    // User information snapshot
    user_name: {
      type: String,
      required: true,
      trim: true,
    },

    user_regNo: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    user_department: {
      type: String,
      required: true,
      trim: true,
    },

    user_Session: {
      type: String,
      required: true,
      trim: true,
    },

    // Reservation ID
    reservedId: {
      type: String,
      unique: true,
      index: true,
      immutable: true,
      default: () =>
        `RB-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
    },

    status: {
      type: String,
      enum: ["pending", "issued", "expired"],
      default: "pending",
      index: true,
    },

    // Reservation creation time
    reservedAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },

    // Automatically expires after 2 hours
    expiresAt: {
      type: Date,
      required: true,
      default: function () {
        return new Date(
          this.reservedAt.getTime() +
            RESERVATION_DURATION_HOURS * 60 * 1000,
        );
      },
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// User's reservations
reserveBookSchema.index({
  user: 1,
  reservedAt: -1,
});

// Book's reservations
reserveBookSchema.index({
  book: 1,
  reservedAt: -1,
});

// Find active reservations for a book
reserveBookSchema.index({
  book: 1,
  status: 1,
  reservedAt: 1,
});

export const ReserveBook = mongoose.model(
  "ReservedBook",
  reserveBookSchema,
);