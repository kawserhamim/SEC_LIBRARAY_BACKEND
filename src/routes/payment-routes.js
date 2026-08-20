import { Router } from "express";
import {
  ipnHandler,
  paymentSuccessHandler,
  paymentFailHandler,
  paymentCancelHandler,
} from "../controllers/payment-controller.js";
import { paymentPublicRateLimiter } from "../middlewares/rate-limiter.js";

const router = Router();

router.use(paymentPublicRateLimiter);

router.post("/sslcommerz/ipn", ipnHandler);

// SSLCommerz posts these from the customer's browser after checkout.
router.post("/sslcommerz/success", paymentSuccessHandler);
router.post("/sslcommerz/fail", paymentFailHandler);
router.post("/sslcommerz/cancel", paymentCancelHandler);

export default router;
