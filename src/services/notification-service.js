import { Notification } from "../models/notification-model.js";
import { Waitlist } from "../models/waitlist-model.js";
import { Book } from "../models/book-model.js";


// =====================================================
// CREATE BOOK-AVAILABLE NOTIFICATION
// Used when a book a user waitlisted becomes available.
// Removes the user from the active waitlist for that book.
// =====================================================

export async function createBookAvailableNotification({
  userId,
  bookId,
  waitlistId,
  userName,
  userRegNo,
  userDepartment,
  userSession,
}) {
  // ---------------------------------------------
  // Load book snapshot (so the notification has a
  // usable title even if the book is later deleted)
  // ---------------------------------------------

  const book = await Book.findById(bookId)
    .select("title authors")
    .lean();

  const bookTitle = book?.title || "your book";

  // ---------------------------------------------
  // The waitlist row will be deleted at the call
  // site (`triggerWaitlistAvailability`) after the
  // notification is successfully created, so the
  // user won't be picked again.
  // ---------------------------------------------

  // ---------------------------------------------
  // Create the notification
  // ---------------------------------------------

  return Notification.create({
    user: userId,
    type: "BOOK_AVAILABLE",
    title: `Book available: ${bookTitle}`,
    message: `The book "${bookTitle}" you were waiting for is now available. Reserve it before someone else does.`,
    book: bookId,
    bookTitle,
    relatedId: waitlistId ? String(waitlistId) : null,
    userName: userName ?? null,
    userRegNo: userRegNo ?? null,
    userDepartment: userDepartment ?? null,
    userSession: userSession ?? null,
    read: false,
  });
}


// =====================================================
// TRIGGER WAITLIST AVAILABILITY FOR A BOOK
// When a book becomes available (regardless of how
// many copies), this finds EVERY active waitlister
// for that book, creates a Notification row for each
// of them, and DELETES those waitlist rows (they have
// been served).
//
// Safe to call whenever copies become available
// (cron expiry, admin return, admin adds copies, etc.).
//
// `availableCopies` is kept in the signature for
// backward compatibility but is no longer used to
// cap the number of users notified.
// =====================================================

export async function triggerWaitlistAvailability(
  bookId,
  availableCopies = 1,
) {
  if (!bookId) return null;

  // ---------------------------------------------
  // Pick EVERY active, unnotified waitlist entry
  // for this book. No cap based on copy count — if
  // the book is available, every waitlister is told.
  // ---------------------------------------------

  const pickedEntries = await Waitlist.find({
    book: bookId,
    isActive: true,
    notified: false,
  })
    .sort({ createdAt: 1 })
    .lean();

  if (pickedEntries.length === 0) {
    return {
      notified: [],
      notifiedCount: 0,
      waitlistIds: [],
    };
  }

  const waitlistIds = pickedEntries.map((entry) => entry._id);

  // ---------------------------------------------
  // Create one Notification per picked waitlister
  // ---------------------------------------------

  const notifications = await Promise.all(
    pickedEntries.map((entry) =>
      createBookAvailableNotification({
        userId: entry.user,
        bookId,
        waitlistId: entry._id,
        userName: entry.name,
        userRegNo: entry.regNo,
        userDepartment: entry.department,
        userSession: entry.Session,
      }),
    ),
  );

  // ---------------------------------------------
  // Delete (not just mark inactive) the picked
  // waitlist rows. They have been served.
  // ---------------------------------------------

  await Waitlist.deleteMany({
    _id: { $in: waitlistIds },
  });

  return {
    notified: notifications,
    notifiedCount: notifications.length,
    waitlistIds,
  };
}


// =====================================================
// LIST MY NOTIFICATIONS
// Paginated, newest first. Unread come first by default.
// =====================================================

export async function getMyNotifications(userId, query = {}) {
  const offset = Number.parseInt(query.offset ?? "0", 10);
  const limit = Math.min(
    Number.parseInt(query.limit ?? "20", 10),
    100,
  );

  const onlyUnread = query.unread === "true";

  const filter = {
    user: userId,
    ...(onlyUnread ? { read: false } : {}),
  };

  const [totalCount, notifications] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
  ]);

  const unreadCount = await Notification.countDocuments({
    user: userId,
    read: false,
  });

  return {
    notifications,
    totalCount,
    unreadCount,
    offset,
    limit,
  };
}


// =====================================================
// MARK ONE NOTIFICATION AS READ
// =====================================================

export async function markNotificationRead(userId, notificationId) {
  const updated = await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      user: userId,
    },
    {
      $set: {
        read: true,
        readAt: new Date(),
      },
    },
    {
      new: true,
    },
  );

  return updated;
}


// =====================================================
// MARK ALL MY NOTIFICATIONS AS READ
// =====================================================

export async function markAllNotificationsRead(userId) {
  const result = await Notification.updateMany(
    {
      user: userId,
      read: false,
    },
    {
      $set: {
        read: true,
        readAt: new Date(),
      },
    },
  );

  return {
    modifiedCount: result.modifiedCount || 0,
  };
}