// =====================================================
// ADMIN ACCESS ROUTES
// Beginner-friendly version.
//
// Mounted in app.js at:  /api/admin/access
// Every route below is protected by authenticateAdmin.
// =====================================================

import { Router } from "express";

import {
    // book management
    addBook,
    updateBook,
    deleteBook,
    getBooksForAdmin,
    searchBook,
    // student management
    addStudent,
    deleteStudent,
    getAllStudent,
    searchStudent,
    // issue / return
    issueReservedBook,
    issueBookDirect,
    returnIssuedBook,
    // reporting
    getIssuedBook,
    getAllReservation,
} from "../controllers/admin-access-controllers.js";

import { authenticateAdmin } from "../middlewares/admin-middleware.js";

const router = Router();

// protect all routes with admin auth
router.use(authenticateAdmin);


// BOOK MANAGEMENT
router.post("/books", addBook);                       // add book
router.patch("/books/:id", updateBook);               // update book
router.delete("/books/:id", deleteBook);              // delete book
router.get("/books", getBooksForAdmin);               // list books
router.get("/books/search", searchBook);              // search books


// STUDENT MANAGEMENT
               
router.get("/students", getAllStudent);               // list students
router.post("/students/search", searchStudent);       // search student
router.delete("/students/:id", deleteStudent);        // delete student


// ISSUE FLOW
router.post(
    "/books/:bookId/issue/:reservationId",
    issueReservedBook,
);


// Issue a book directly to a student (no reservation needed)
// POST /api/admin/access/books/:bookId/issue-to
//   Body (required): { regNo } — student's regNo.
router.post(
    "/books/:bookId/issue-to",
    issueBookDirect,
);


// RETURN FLOW
router.post(
    "/issued/:issuedId/return",
    returnIssuedBook,
);


// REPORTING
router.get("/issued", getIssuedBook);                 // list issued books
router.get("/reservations", getAllReservation);       // list reservations


export default router;
