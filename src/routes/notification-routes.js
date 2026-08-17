import { Router } from "express";
import {
  getMyNotificationsHandler,
  markNotificationReadHandler,
  markAllNotificationsReadHandler,
} from "../controllers/notification-controller.js";
import { authenticate } from "../middlewares/auth-middleware.js";

const router = Router();

router.get("/notifications", authenticate, getMyNotificationsHandler);
router.patch("/notifications/:notificationId/read", authenticate, markNotificationReadHandler);
router.patch("/notifications/read-all", authenticate, markAllNotificationsReadHandler);

export default router;