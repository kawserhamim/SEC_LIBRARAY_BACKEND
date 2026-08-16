// import express from "express";

// import {
//     createResearchPaper,
//     getAllResearchPapers,
//     getResearchPaperById,
//     searchResearchPapers,
//     updateResearchPaper,
//     deleteResearchPaper
// } from "../controllers/research-paper-controller.js";

// import authMiddleware from "../middlewares/auth-middleware.js";
// import adminMiddleware from "../middlewares/admin-middleware.js";

// const router = express.Router();

// /*
// ========================================
// PUBLIC / STUDENT
// ========================================
// */

// // Search
// router.get(
//     "/search",
//     searchResearchPapers
// );

// // Get all
// router.get(
//     "/",
//     getAllResearchPapers
// );

// // Get single
// router.get(
//     "/:id",
//     getResearchPaperById
// );


// /*
// ========================================
// ADMIN
// ========================================
// */

// // Create
// router.post(
//     "/",
//     authMiddleware,
//     adminMiddleware,
//     createResearchPaper
// );

// // Update
// router.patch(
//     "/:id",
//     authMiddleware,
//     adminMiddleware,
//     updateResearchPaper
// );

// // Delete
// router.delete(
//     "/:id",
//     authMiddleware,
//     adminMiddleware,
//     deleteResearchPaper
// );

// export default router;