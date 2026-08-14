import mongoose from "mongoose";

import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notification-service.js";


// =====================================================
// GET MY NOTIFICATIONS
// GET /api/student/notifications?offset=0&limit=20&unread=false
// =====================================================

export const getMyNotificationsHandler = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await getMyNotifications(userId, req.query);

    return res.status(200).json({
      success: true,
      message:
        result.notifications.length > 0
          ? "Notifications found"
          : "No notifications yet",
      ...result,
      pagination: {
        offset: result.offset,
        limit: result.limit,
        hasNextPage:
          result.offset + result.notifications.length <
          result.totalCount,
        hasPreviousPage: result.offset > 0,
      },
    });
  } catch (error) {
    console.error("getMyNotifications:", error);
    return res.status(500).json({
      success: false,
      message: "Error in getting notifications",
    });
  }
};


// =====================================================
// MARK ONE NOTIFICATION AS READ
// PATCH /api/student/notifications/:notificationId/read
// =====================================================

export const markNotificationReadHandler = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    const notification = await markNotificationRead(
      userId,
      notificationId,
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    console.error("markNotificationRead:", error);
    return res.status(500).json({
      success: false,
      message: "Error in marking notification as read",
    });
  }
};


// =====================================================
// MARK ALL MY NOTIFICATIONS AS READ
// PATCH /api/student/notifications/read-all
// =====================================================

export const markAllNotificationsReadHandler = async (req, res) => {
  try {
    const userId = req.user.id;

    const { modifiedCount } = await markAllNotificationsRead(userId);

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      data: {
        modifiedCount,
      },
    });
  } catch (error) {
    console.error("markAllNotificationsRead:", error);
    return res.status(500).json({
      success: false,
      message: "Error in marking all notifications as read",
    });
  }
};