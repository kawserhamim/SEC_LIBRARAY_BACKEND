import { Router } from "express";
import {
  createResearchPaper,
  getAllResearchPapers,
  getResearchPaperById,
  searchResearchPapers,
  updateResearchPaper,
  deleteResearchPaper,
} from "../controllers/research-paper-controller.js";
import { authenticate } from "../middlewares/auth-middleware.js";
import { authenticateAdmin } from "../middlewares/admin-middleware.js";

const router = Router();

// Student / Public
router.get("/search", searchResearchPapers);
router.get("/", getAllResearchPapers);
router.get("/:id", getResearchPaperById);

// Admin
router.post("/", authenticate, authenticateAdmin, createResearchPaper);
router.patch("/:id", authenticate, authenticateAdmin, updateResearchPaper);
router.delete("/:id", authenticate, authenticateAdmin, deleteResearchPaper);

export default router;