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
import {
  getAllResearchPapers,
  getResearchPaperById,
  searchResearchPapers,
} from "../controllers/research-paper-controller.js";
import { authenticate } from "../middlewares/auth-middleware.js";

const router = express.Router();

router.use(authenticate);

// Books
router.get("/books", getBooksForStudent);
router.get("/books/search", searchBook);

// Reservations
router.post("/books/:bookId/reserve", reserveBook);
router.get("/reservations", getMyReservations);

// Waitlist
router.post("/books/:bookId/waitlist", joinWaitlist);
router.get("/waitlist", viewMyWaitlist);
router.delete("/books/:bookId/waitlist", cancelWaitlist);

// Issued Books
router.get("/issued", getMyIssuedBooks);

// Research Papers
router.get("/research-papers", getAllResearchPapers);
router.get("/research-papers/search", searchResearchPapers);
router.get("/research-papers/:id", getResearchPaperById);

export default router;