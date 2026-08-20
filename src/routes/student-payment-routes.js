import { Router } from "express";
import {
  initPaymentHandler,
  myPaymentHistoryHandler,
  myPaymentStatusHandler,
} from "../controllers/payment-controller.js";
import { authenticate } from "../middlewares/auth-middleware.js";
import { studentRateLimiter } from "../middlewares/rate-limiter.js";

const router = Router();

router.use(authenticate);
router.use(studentRateLimiter);

router.post("/init", initPaymentHandler);
router.get("/history", myPaymentHistoryHandler);
router.get("/status/:tran_id", myPaymentStatusHandler);

export default router;
