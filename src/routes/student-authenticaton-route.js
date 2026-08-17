import express from "express";
import {
  createStudentAuthentication,
  deleteStudentAuthentication,
  getAllStudentAuthentications,
  searchStudentAuthentication,
} from "../controllers/student-authentication-controller.js";
import { authenticateAdmin } from "../middlewares/admin-middleware.js";

const router = express.Router();

router.post("/add", authenticateAdmin, createStudentAuthentication);
router.delete("/delete/:id", authenticateAdmin, deleteStudentAuthentication);
router.get("/all", authenticateAdmin, getAllStudentAuthentications);
router.post("/search", authenticateAdmin, searchStudentAuthentication);

export default router;