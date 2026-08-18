import { Router } from "express";
import {
  register,
  login,
  logout,
  me,
  changePassword,
} from "../controllers/user-register-controller.js";
import { checkRegNo, googleAuth } from "../controllers/google-auth-controller.js";
import { authenticate } from "../middlewares/auth-middleware.js";
import { authRateLimiter } from "../middlewares/rate-limiter.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", authenticate, logout);
router.get("/me", authenticate, me);
router.post("/change-password", authenticate, changePassword);
router.post("/check-regno", authRateLimiter, checkRegNo);
router.post("/google-auth", authRateLimiter, googleAuth);

export default router;
