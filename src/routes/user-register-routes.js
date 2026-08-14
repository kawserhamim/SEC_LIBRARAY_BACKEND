import { Router } from "express";
import { register, login, logout, me, changePassword } from "../controllers/user-register-controller.js";
import { authenticate } from "../middlewares/auth-middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", authenticate, logout);
router.get("/me", authenticate, me);
router.post("/change-password", authenticate, changePassword);

export default router;
