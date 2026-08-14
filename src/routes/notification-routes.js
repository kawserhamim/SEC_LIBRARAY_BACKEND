import { Router } from "express";

import {
  getMyNotificationsHandler,
  markNotificationReadHandler,
  markAllNotificationsReadHandler,
} from "../controllers/notification-controller.js";

import { authenticate } from "../middlewares/auth-middleware.js";

const router = Router();

// =====================================================
// NOTIFICATION ROUTES (student)
// =====================================================

// Get my notifications
// GET /api/student/notifications
// GET /api/student/notifications?unread=true
// GET /api/student/notifications?offset=0&limit=20
router.get(
  "/notifications",
  authenticate,
  getMyNotificationsHandler,
);

// Mark one notification as read
// PATCH /api/student/notifications/:notificationId/read
router.patch(
  "/notifications/:notificationId/read",
  authenticate,
  markNotificationReadHandler,
);

// Mark all my notifications as read
// PATCH /api/student/notifications/read-all
router.patch(
  "/notifications/read-all",
  authenticate,
  markAllNotificationsReadHandler,
);

export default router;