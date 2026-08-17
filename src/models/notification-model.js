import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userName: { type: String, default: null, trim: true },
    userRegNo: { type: String, default: null, trim: true, index: true },
    userDepartment: { type: String, default: null, trim: true },
    userSession: { type: String, default: null, trim: true },
    type: {
      type: String,
      required: true,
      enum: ["BOOK_AVAILABLE", "RESERVATION_EXPIRED", "DUE_REMINDER", "GENERAL"],
      default: "GENERAL",
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      default: null,
      index: true,
    },
    bookTitle: { type: String, default: null, trim: true },
    relatedId: { type: String, default: null, trim: true },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);