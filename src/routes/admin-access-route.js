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
} from "../controllers/admin-access-controllers.js";

import {
    createResearchPaper,
    getAllResearchPapers,
    getResearchPaperById,
    searchResearchPapers,
    updateResearchPaper,
    deleteResearchPaper,
} from "../controllers/research-paper-controller.js";

import { authenticateAdmin } from "../middlewares/admin-middleware.js";

const router = Router();

// Protect all admin routes
router.use(authenticateAdmin);


// Book management

router.post("/books", addBook);
router.patch("/books/:id", updateBook);
router.delete("/books/:id", deleteBook);
router.get("/books", getBooksForAdmin);
router.get("/books/search", searchBook);


// Student management

router.get("/students", getAllStudent);

router.post("/students/search", searchStudent);

router.get("/students/search", searchRegisteredStudents); 


// Issue and return

router.post(
    "/books/:bookId/issue/:reservationId",
    issueReservedBook
);

router.post(
    "/books/:bookId/issue-to",
    issueBookDirect
);

router.post(
    "/issued/:issuedId/return",
    returnIssuedBook
);


// Reports

router.get("/issued", getIssuedBook);
router.get("/reservations", getAllReservation);


// Dashboard statistics

router.get("/stats/users", getUserStats);
router.get("/stats/books", getBookStats);
router.get("/stats/issued", getIssueStats);
router.get("/stats/reservations", getReservationStats);


// Research papers

router.get(
    "/research-papers/search",
    searchResearchPapers
);

router.get(
    "/research-papers",
    getAllResearchPapers
);

router.get(
    "/research-papers/:id",
    getResearchPaperById
);

router.post(
    "/research-papers/create",
    createResearchPaper
);

router.patch(
    "/research-papers/:id",
    updateResearchPaper
);

router.delete(
    "/research-papers/:id",
    deleteResearchPaper
);


export default router;