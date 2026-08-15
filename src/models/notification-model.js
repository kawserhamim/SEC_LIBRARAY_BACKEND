import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    // Which user this notification belongs to
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ------------------------------
    // Student snapshot
    // (denormalized so reads do not
    // need to join the User table)
    // ------------------------------

    userName: {
      type: String,
      default: null,
      trim: true,
    },

    userRegNo: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    userDepartment: {
      type: String,
      default: null,
      trim: true,
    },

    userSession: {
      type: String,
      default: null,
      trim: true,
    },

    // Notification category
    type: {
      type: String,
      required: true,
      enum: [
        "BOOK_AVAILABLE",
        "RESERVATION_EXPIRED",
        "DUE_REMINDER",
        "GENERAL",
      ],
      default: "GENERAL",
      index: true,
    },

    // Short headline
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    // Full message body
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    // Optional reference to a book (e.g. waitlist target)
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      default: null,
      index: true,
    },

    // Book title snapshot for fast display
    bookTitle: {
      type: String,
      default: null,
      trim: true,
    },

    // Optional link to the originating record
    // (e.g. waitlist _id, reservation reservedId)
    relatedId: {
      type: String,
      default: null,
      trim: true,
    },

    // Has the user seen it?
    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    // When it was marked as read
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Common query: latest notifications for a user, unread first
notificationSchema.index({
  user: 1,
  read: 1,
  createdAt: -1,
});

// Common query: a user's feed by recency
notificationSchema.index({
  user: 1,
  createdAt: -1,
});

export const Notification = mongoose.model(
  "Notification",
  notificationSchema,
);