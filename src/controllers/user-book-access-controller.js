import mongoose from "mongoose";

import { Book } from "../models/book-model.js";
import { ReserveBook } from "../models/reserve-book.js";
import { IssuedBook } from "../models/issuebook-model.js";
import { Waitlist } from "../models/waitlist-model.js";
import { buildBookSearchFilter } from "../utils/book-search.js";
import { enqueueWaitlistAvailability } from "../queues/waitlist-queue.js";


// =====================================================
// PAGINATION
// =====================================================

const getOffsetPagination = (query) => {
  const offset = Number.parseInt(query.offset ?? "0", 10);
  const limit = Number.parseInt(query.limit ?? "3", 10);

  if (Number.isNaN(offset) || offset < 0) {
    return {
      error: "offset must be a non-negative number",
    };
  }

  if (Number.isNaN(limit) || limit <= 0) {
    return {
      error: "limit must be a positive number",
    };
  }

  return {
    offset,
    limit,
  };
};


// =====================================================
// GET BOOKS FOR STUDENT
// GET /api/books?category=CSE&offset=0&limit=3
// =====================================================

export const getBooksForStudent = async (req, res) => {
  try {
    const { category } = req.query;

    const pagination = getOffsetPagination(req.query);

    if (pagination.error) {
      return res.status(400).json({
        success: false,
        message: pagination.error,
      });
    }

    const { offset, limit } = pagination;

    // ---------------------------------------------
    // Filter
    // ---------------------------------------------

    const filter = {};

    if (category) {
      filter.category = category;
    }

    // ---------------------------------------------
    // Get total count + books
    // ---------------------------------------------

    const [totalCount, books] = await Promise.all([
      Book.countDocuments(filter),

      Book.find(filter)
        .select(
          "title authors category totalCopies availableCopies coverImage"
        )
        .sort({ title: 1 })
        .skip(offset)
        .limit(limit)
        .lean(),
    ]);

    // ---------------------------------------------
    // Response
    // ---------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        books.length > 0
          ? "Books found successfully"
          : "No books found",

      totalCount,

      pagination: {
        offset,
        limit,

        hasNextPage:
          offset + books.length < totalCount,

        hasPreviousPage:
          offset > 0,
      },

      user: {
        name: req.user.name,
        regNo: req.user.regNo,
        department: req.user.department,
        Session: req.user.Session,
      },

      data: books,
    });
  } catch (error) {
    console.error(
      "getBooksForStudent:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Error in getting books for student",
    });
  }
};


// =====================================================
// SEARCH BOOK
// GET /api/books/search?query=clean
// Searches across title, authors, category, and ISBN.
// =====================================================

export const searchBook = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const { filter, searchedFields } = buildBookSearchFilter(query);

    const books = await Book.find(filter)
      .select(
        "title authors category isbn totalCopies availableCopies coverImage"
      )
      .sort({ title: 1 })
      .lean();

    return res.status(200).json({
      success: true,

      message:
        books.length > 0
          ? "Books found"
          : "No books found",

      query: query.trim(),
      searchedFields,
      totalCount: books.length,

      data: books,
    });
  } catch (error) {
    console.error(
      "searchBook:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Error in searching books",
    });
  }
};


// =====================================================
// RESERVE BOOK
// Student reserves an available book for 2 hours
// =====================================================

export const reserveBook = async (req, res) => {
  try {
    const { bookId } = req.params;

    const userId = req.user._id;

    // ---------------------------------------------
    // Validate book ID
    // ---------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID",
      });
    }

    // ---------------------------------------------
    // Find book
    // ---------------------------------------------

    const book = await Book.findById(bookId).lean();

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    // ---------------------------------------------
    // Book unavailable
    // ---------------------------------------------

    if (book.availableCopies <= 0) {
      return res.status(409).json({
        success: false,
        message:
          "No available copy. You can join the waitlist.",
      });
    }

    // ---------------------------------------------
    // Find student
    // ---------------------------------------------
    //
    // req.user is populated by the auth middleware
    // and contains the full user snapshot.
    // ---------------------------------------------

    const user = req.user;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // ---------------------------------------------
    // Check existing active reservation
    // ---------------------------------------------
    //
    // Reservation is active if:
    //
    // status = pending
    // expiresAt > current time
    //
    // ---------------------------------------------

    const existingReservation =
      await ReserveBook.findOne({
        user: userId,
        book: bookId,

        status: "pending",

        expiresAt: {
          $gt: new Date(),
        },
      });

    if (existingReservation) {
      return res.status(409).json({
        success: false,
        message:
          "You already have an active reservation for this book",

        data: {
          reservedId:
            existingReservation.reservedId,

          expiresAt:
            existingReservation.expiresAt,
        },
      });
    }

    // ---------------------------------------------
    // Create reservation
    // ---------------------------------------------

    const reservation =
      await ReserveBook.create({
        book: book._id,

        book_title: book.title,

        book_authors: book.authors,

        user: user._id,

        user_name: user.name,

        user_regNo: user.regNo,

        user_department: user.department,

        user_Session: user.Session,

        status: "pending",

        reservedAt: new Date(),

        // 2 hours
        expiresAt: new Date(
          Date.now() + 2 * 60 * 1000,
        ),
      });

    return res.status(201).json({
      success: true,

      message:
        "Book reserved successfully for 2 hours",

      data: {
        reservedId:
          reservation.reservedId,

        book: {
          id: reservation.book,

          title:
            reservation.book_title,

          authors:
            reservation.book_authors,
        },

        student: {
          _id: reservation.user,

          name:
            reservation.user_name,

          regNo:
            reservation.user_regNo,

          department:
            reservation.user_department,

          Session:
            reservation.user_Session,
        },

        status:
          reservation.status,

        reservedAt:
          reservation.reservedAt,

        expiresAt:
          reservation.expiresAt,
      },
    });
  } catch (error) {
    console.error(
      "reserveBook:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to reserve book",
    });
  }
};


// =====================================================
// JOIN WAITLIST
// =====================================================

export const joinWaitlist = async (req, res) => {
  try {
    const { bookId } = req.params;

    const userId = req.user._id;

    // ---------------------------------------------
    // Validate book ID
    // ---------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID",
      });
    }

    // ---------------------------------------------
    // Find book
    // ---------------------------------------------

    const book = await Book.findById(bookId).lean();

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    // ---------------------------------------------
    // If available, don't waitlist
    // ---------------------------------------------

    if (book.availableCopies > 0) {
      return res.status(409).json({
        success: false,
        message:
          "Book is currently available. You can reserve it instead.",
      });
    }

    // ---------------------------------------------
    // Find student
    // ---------------------------------------------
    //
    // req.user is populated by the auth middleware
    // and contains the full user snapshot.
    // ---------------------------------------------

    const user = req.user;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // ---------------------------------------------
    // Create waitlist
    // ---------------------------------------------

    const waitlist = await Waitlist.create({
      user: user._id,

      book: book._id,

      // Student snapshot
      name: user.name,

      email: user.email,

      regNo: user.regNo,

      department: user.department,

      Session: user.Session,

      // Book snapshot
      bookTitle: book.title,

      bookAuthors: book.authors,

      notified: false,

      isActive: true,
    });

    return res.status(201).json({
      success: true,

      message:
        "Successfully joined the waitlist",

      data: {
        waitlistId:
          waitlist._id,

        book: {
          id: waitlist.book,

          title:
            waitlist.bookTitle,

          authors:
            waitlist.bookAuthors,
        },

        student: {
          _id: waitlist.user,

          name:
            waitlist.name,

          email:
            waitlist.email,

          regNo:
            waitlist.regNo,

          department:
            waitlist.department,

          Session:
            waitlist.Session,
        },

        notified:
          waitlist.notified,

        isActive:
          waitlist.isActive,

        createdAt:
          waitlist.createdAt,
      },
    });
  } catch (error) {
    // ---------------------------------------------
    // Duplicate active waitlist
    // ---------------------------------------------

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "You are already on the waitlist for this book",
      });
    }

    console.error(
      "joinWaitlist:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to join the waitlist",
    });
  }
};


// =====================================================
// VIEW MY WAITLIST
// =====================================================

export const viewMyWaitlist = async (req, res) => {
  try {
    const userId = req.user._id;

    const pagination =
      getOffsetPagination(req.query);

    if (pagination.error) {
      return res.status(400).json({
        success: false,
        message: pagination.error,
      });
    }

    const { offset, limit } =
      pagination;

    const filter = {
      user: userId,
      isActive: true,
    };

    const [
      totalCount,
      waitlists,
    ] = await Promise.all([
      Waitlist.countDocuments(filter),

      Waitlist.find(filter)
        .select(
          "book bookTitle bookAuthors notified isActive createdAt"
        )
        .sort({ createdAt: 1 })
        .skip(offset)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,

      message:
        waitlists.length > 0
          ? "Active waitlists found"
          : "No active waitlist",

      totalCount,

      pagination: {
        offset,
        limit,

        hasNextPage:
          offset + waitlists.length <
          totalCount,

        hasPreviousPage:
          offset > 0,
      },

      data: waitlists,
    });
  } catch (error) {
    console.error(
      "viewMyWaitlist:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        "Error in getting waitlist",
    });
  }
};


// =====================================================
// CANCEL WAITLIST
// =====================================================

export const cancelWaitlist = async (req, res) => {
  try {
    const { bookId } = req.params;

    const userId = req.user._id;

    if (
      !mongoose.Types.ObjectId.isValid(bookId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID",
      });
    }

    /*
     * You previously said:
     * "cancel reservation should be removed"
     *
     * So we actually delete the waitlist document.
     */

    const deleted =
      await Waitlist.findOneAndDelete({
        book: bookId,

        user: userId,

        isActive: true,
      });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message:
          "Active waitlist not found",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Waitlist cancelled successfully",
    });
  } catch (error) {
    console.error(
      "cancelWaitlist:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        "Error in cancelling waitlist",
    });
  }
};


// =====================================================
// GET MY RESERVATIONS
// GET /api/student/reservations?status=pending&offset=0&limit=3
// Returns the books the logged-in student reserved.
// =====================================================

export const getMyReservations = async (req, res) => {
  try {
    const userId = req.user._id;

    const pagination = getOffsetPagination(req.query);

    if (pagination.error) {
      return res.status(400).json({
        success: false,
        message: pagination.error,
      });
    }

    const offset = pagination.offset;
    const limit = pagination.limit;

    // build filter: always by user, plus optional status
    const filter = { user: userId };

    if (req.query.status) {
      const ok = ["pending", "issued", "expired"];
      if (!ok.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid status. Use pending, issued or expired.",
        });
      }
      filter.status = req.query.status;
    }

    // count + page in parallel
    const totalCount = await ReserveBook.countDocuments(filter);

    const rows = await ReserveBook.find(filter)
      .select(
        "reservedId book book_title book_authors status reservedAt expiresAt",
      )
      .sort({ reservedAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    // shape the data simply
    const now = new Date();

    const data = rows.map((r) => {
      const expiredByClock =
        r.status === "pending" && r.expiresAt <= now;

      return {
        reservedId: r.reservedId,
        bookTitle: r.book_title,
        bookAuthors: r.book_authors,
        bookId: r.book,
        status: expiredByClock ? "expired" : r.status,
        reservedAt: r.reservedAt,
        expiresAt: r.expiresAt,
      };
    });

    return res.status(200).json({
      success: true,
      message:
        data.length > 0
          ? "Reservations found"
          : "No reservations found",
      totalCount,
      offset,
      limit,
      data,
    });
  } catch (error) {
    console.error("getMyReservations:", error);
    return res.status(500).json({
      success: false,
      message: "Error in getting reservations",
    });
  }
};


// =====================================================
// GET MY ISSUED BOOKS
// GET /api/student/issued?status=borrowed&offset=0&limit=3
// Returns the books issued to the logged-in student.
// =====================================================

export const getMyIssuedBooks = async (req, res) => {
  try {
    const userId = req.user._id;

    const pagination = getOffsetPagination(req.query);

    if (pagination.error) {
      return res.status(400).json({
        success: false,
        message: pagination.error,
      });
    }

    const offset = pagination.offset;
    const limit = pagination.limit;

    // build filter: always by user, plus optional status
    const filter = { user: userId };

    if (req.query.status) {
      const ok = ["borrowed", "returned", "overdue"];
      if (!ok.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid status. Use borrowed, returned or overdue.",
        });
      }
      filter.status = req.query.status;
    }

    // count + page in parallel
    const totalCount = await IssuedBook.countDocuments(filter);

    const rows = await IssuedBook.find(filter)
      .select(
        "issuedId book bookTitle bookAuthors status borrowedAt dueDate returnedAt",
      )
      .sort({ borrowedAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    // shape the data simply
    const now = new Date();

    const data = rows.map((b) => {
      const overdueByClock =
        b.status === "borrowed" && b.dueDate <= now;

      return {
        issuedId: b.issuedId,
        bookTitle: b.bookTitle,
        bookAuthors: b.bookAuthors,
        bookId: b.book,
        status: overdueByClock ? "overdue" : b.status,
        borrowedAt: b.borrowedAt,
        dueDate: b.dueDate,
        returnedAt: b.returnedAt,
      };
    });

    return res.status(200).json({
      success: true,
      message:
        data.length > 0
          ? "Issued books found"
          : "No issued books found",
      totalCount,
      offset,
      limit,
      data,
    });
  } catch (error) {
    console.error("getMyIssuedBooks:", error);
    return res.status(500).json({
      success: false,
      message: "Error in getting issued books",
    });
  }
};


// =====================================================
// (Intentionally empty: students can only RESERVE.
//  Issuing is performed by an admin via:
//    POST /api/admin/access/books/:bookId/issue/:reservationId
//    POST /api/admin/access/books/:bookId/issue-to/:userId
// =====================================================
