import express from "express";

import {
  getBooksForStudent,
  searchBook,
  reserveBook,
  joinWaitlist,
  viewMyWaitlist,
  cancelWaitlist,
  getMyReservations,
  getMyIssuedBooks,
} from "../controllers/user-book-access-controller.js";

import { authenticate } from "../middlewares/auth-middleware.js";

const router = express.Router();


// =====================================================
// BOOK ROUTES
// =====================================================

// Get books for student
// GET /api/student/books
// GET /api/student/books?category=CSE
// GET /api/student/books?category=CSE&offset=0&limit=3

router.get(
  "/books",
  authenticate,
  getBooksForStudent,
);


// Search books
// GET /api/student/books/search?query=clean

router.get(
  "/books/search",
  authenticate,
  searchBook,
);


// =====================================================
// RESERVATION ROUTES
// =====================================================

// Reserve a particular book
// POST /api/student/books/:bookId/reserve

router.post(
  "/books/:bookId/reserve",
  authenticate,
  reserveBook,
);


// =====================================================
// WAITLIST ROUTES
// =====================================================

// Join waitlist for a particular book
// POST /api/student/books/:bookId/waitlist

router.post(
  "/books/:bookId/waitlist",
  authenticate,
  joinWaitlist,
);


// View my active waitlists
// GET /api/student/waitlist


router.get(
  "/waitlist",
  authenticate,
  viewMyWaitlist,
);


// Cancel/remove my waitlist
// DELETE /api/student/books/:bookId/waitlist

router.delete(
  "/books/:bookId/waitlist",
  authenticate,
  cancelWaitlist,
);


// =====================================================
// ISSUE ROUTES (students reserve; admin issues)
// =====================================================

// Students CANNOT issue books themselves.
// They can only reserve a book; an admin converts
// the reservation into an IssuedBook via
//   POST /api/admin/access/books/:bookId/issue/:reservationId
// or issues directly via
//   POST /api/admin/access/books/:bookId/issue-to/:userId


// =====================================================
// MY RESERVATIONS / ISSUED BOOKS
// =====================================================

// View my reservations (books I have reserved)
// GET /api/student/reservations
// GET /api/student/reservations?status=pending
// GET /api/student/reservations?status=issued
// GET /api/student/reservations?status=expired

router.get(
  "/reservations",
  authenticate,
  getMyReservations,
);


// View my issued books (books currently borrowed / returned)
// GET /api/student/issued
// GET /api/student/issued?status=borrowed
// GET /api/student/issued?status=returned
// GET /api/student/issued?status=overdue

router.get(
  "/issued",
  authenticate,
  getMyIssuedBooks,
);


export default router;