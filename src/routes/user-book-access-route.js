import express from "express";

import {
  getBooksForStudent,
  searchBook,
  reserveBook,
  joinWaitlist,
  viewMyWaitlist,
  cancelWaitlist,
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


export default router;