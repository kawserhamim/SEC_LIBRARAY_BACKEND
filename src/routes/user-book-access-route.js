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


// Authentication

router.use(authenticate);


// Book routes

router.get(
    "/books",
    getBooksForStudent
);

router.get(
    "/books/search",
    searchBook
);


// Reservation routes

router.post(
    "/books/:bookId/reserve",
    reserveBook
);


// Waitlist routes

router.post(
    "/books/:bookId/waitlist",
    joinWaitlist
);

router.get(
    "/waitlist",
    viewMyWaitlist
);

router.delete(
    "/books/:bookId/waitlist",
    cancelWaitlist
);


// Reservation and issued book routes

router.get(
    "/reservations",
    getMyReservations
);

router.get(
    "/issued",
    getMyIssuedBooks
);


// Research paper routes

router.get(
    "/research-papers",
    getAllResearchPapers
);

router.get(
    "/research-papers/:id",
    getResearchPaperById
);

router.get(
    "/research-papers/search",
    searchResearchPapers
);


export default router;