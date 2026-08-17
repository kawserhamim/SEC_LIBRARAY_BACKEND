import { Router } from "express";
import {
  registerAdminHandler,
  loginAdminHandler,
  logoutAdminHandler,
  me,
} from "../controllers/admin-register-controller.js";
import { authenticateAdmin, loadAdmin } from "../middlewares/admin-middleware.js";

const router = Router();

router.post("/register", registerAdminHandler);
router.post("/login", loginAdminHandler);
router.post("/logout", authenticateAdmin, logoutAdminHandler);
router.get("/me", authenticateAdmin, loadAdmin, me);

export default router;
