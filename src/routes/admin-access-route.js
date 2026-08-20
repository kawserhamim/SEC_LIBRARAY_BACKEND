import { Router } from "express";
import {
  addBook,
  updateBook,
  deleteBook,
  getBooksForAdmin,
  searchBook,
  getAllStudent,
  searchStudent,
  issueReservedBook,
  issueBookDirect,
  returnIssuedBook,
  getIssuedBook,
  getAllReservation,
  getUserStats,
  getBookStats,
  getIssueStats,
  searchRegisteredStudents,
  getReservationStats,
  getOverdueIssueStats
} from "../controllers/admin-access-controllers.js";
import {
  createResearchPaper,
  getAllResearchPapersForAdmin,
  getPendingResearchPapers,
  getResearchPaperById,
  searchResearchPapers,
  approveResearchPaper,
  rejectResearchPaper,
  updateResearchPaper,
  deleteResearchPaper,
} from "../controllers/research-paper-controller.js";
import { getAllPaymentsHandler } from "../controllers/admin-payment-controller.js";
import { authenticateAdmin } from "../middlewares/admin-middleware.js";

const router = Router();

router.use(authenticateAdmin);

// Books
router.post("/books", addBook);
router.patch("/books/:id", updateBook);
router.delete("/books/:id", deleteBook);
router.get("/books", getBooksForAdmin);
router.get("/books/search", searchBook);

// Students
router.get("/students", getAllStudent);
router.post("/students/search", searchStudent);
router.get("/students/search", searchRegisteredStudents);

// Issue & Return
router.post("/books/:bookId/issue/:reservationId", issueReservedBook);
router.post("/books/:bookId/issue-to", issueBookDirect);
router.post("/issued/:issuedId/return", returnIssuedBook);

// Reports
router.get("/issued", getIssuedBook);
router.get("/reservations", getAllReservation);

// Stats
router.get("/stats/users", getUserStats);
router.get("/stats/books", getBookStats);
router.get("/stats/issued", getIssueStats);
router.get("/stats/reservations", getReservationStats);
router.get("/stats/overdue", getOverdueIssueStats);

// Research papers
router.get("/research-papers/pending", getPendingResearchPapers);
router.get("/research-papers/search", searchResearchPapers);
router.get("/research-papers", getAllResearchPapersForAdmin);
router.get("/research-papers/:id", getResearchPaperById);
router.post("/research-papers/create", createResearchPaper);
router.post("/research-papers/pending/:id/approve", approveResearchPaper);
router.post("/research-papers/approve/:id", approveResearchPaper);
router.post("/research-papers/pending/:id/reject", rejectResearchPaper);
router.post("/research-papers/reject/:id", rejectResearchPaper);
router.patch("/research-papers/:id", updateResearchPaper);
router.delete("/research-papers/:id", deleteResearchPaper);

// Payments (fine clearance via SSLCommerz) — read-only audit view
router.get("/payments", getAllPaymentsHandler);

export default router;