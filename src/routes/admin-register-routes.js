import { Router } from "express";
import {
  registerAdminHandler,
  loginAdminHandler,
  logoutAdminHandler,
} from "../controllers/admin-register-controller.js";
import { authenticateAdmin } from "../middlewares/admin-middleware.js";

const router = Router();

router.post("/register", registerAdminHandler);
router.post("/login", loginAdminHandler);
router.post("/logout", authenticateAdmin, logoutAdminHandler);

export default router;
