import { Server } from "socket.io";
import { verifyAuthToken } from "./token-service.js";
import { IssuedBook } from "../models/issuebook-model.js";
import { ReserveBook } from "../models/reserve-book.js";

let ioInstance = null;
export const ADMIN_ROOM = "admin:room";

/**
 * Helper to parse cookie string from handshake headers
 */
function parseCookie(cookieString, cookieName) {
  if (!cookieString) return null;
  const match = cookieString.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Initialize Socket.io with HTTP server instance
 */
export function initSocket(httpServer) {
  const allowedOrigins = [
    process.env.CLIENT_URL,
    process.env.STUDENT_CLIENT_URL,
  ].filter(Boolean);

  ioInstance = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or same-origin)
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
    },
  });

  // Socket Authentication Middleware
  ioInstance.use((socket, next) => {
    try {
      // Check auth object, Authorization header, or cookie
      let token = socket.handshake.auth?.token;

      if (!token && socket.handshake.headers?.authorization) {
        const authHeader = socket.handshake.headers.authorization;
        if (authHeader.startsWith("Bearer ")) {
          token = authHeader.substring(7).trim();
        }
      }

      if (!token && socket.handshake.headers?.cookie) {
        token = parseCookie(socket.handshake.headers.cookie, "auth_token");
      }

      if (!token) {
        return next(new Error("Authentication token required for WebSocket connection"));
      }

      const decoded = verifyAuthToken(token);
      socket.user = decoded; // Contains id, role, etc.
      next();
    } catch (err) {
      console.warn("[WebSocket] Handshake auth failed:", err.message);
      next(new Error("Invalid or expired authentication token"));
    }
  });

  // Connection Handler
  ioInstance.on("connection", (socket) => {
    const userId = socket.user?.id || socket.user?._id;
    const role = socket.user?.role;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    const userRoom = `user:${userId}`;
    socket.join(userRoom);
    console.log(`[WebSocket] User ${userId} connected and joined room ${userRoom}`);

    if (role === "admin") {
      socket.join(ADMIN_ROOM);
      console.log(`[WebSocket] Admin ${userId} joined room ${ADMIN_ROOM}`);

      // Push initial stats to newly connected admin
      broadcastOverdueStats(socket).catch((err) => {
        console.error("[WebSocket] Failed to send initial overdue stats:", err?.message);
      });
      broadcastReservationStats(socket).catch((err) => {
        console.error("[WebSocket] Failed to send initial reservation stats:", err?.message);
      });

      // Handle on-demand admin stats requests
      socket.on("admin:get_overdue_stats", async () => {
        await broadcastOverdueStats(socket);
      });

      socket.on("admin:get_reservation_stats", async () => {
        await broadcastReservationStats(socket);
      });

      socket.on("admin:get_all_stats", async () => {
        await Promise.all([
          broadcastOverdueStats(socket),
          broadcastReservationStats(socket),
        ]);
      });
    }

    socket.on("disconnect", (reason) => {
      console.log(`[WebSocket] User ${userId} disconnected (${reason})`);
    });
  });

  return ioInstance;
}

/**
 * Get active Socket.io instance
 */
export function getIO() {
  return ioInstance;
}

/**
 * Emit an event to a specific user room
 */
export function emitToUser(userId, event, data) {
  if (!ioInstance) {
    console.warn("[WebSocket] Cannot emit event; Socket.io instance is not initialized yet.");
    return false;
  }
  if (!userId) return false;

  const userRoom = `user:${String(userId)}`;
  ioInstance.to(userRoom).emit(event, data);
  console.log(`[WebSocket] Emitted "${event}" to ${userRoom}`);
  return true;
}

/**
 * Emit an event to all connected admins in ADMIN_ROOM
 */
export function emitToAdmin(event, data) {
  if (!ioInstance) {
    console.warn("[WebSocket] Cannot emit event; Socket.io instance is not initialized yet.");
    return false;
  }

  ioInstance.to(ADMIN_ROOM).emit(event, data);
  console.log(`[WebSocket] Emitted "${event}" to ${ADMIN_ROOM}`);
  return true;
}

/**
 * Fetch and broadcast total overdue book count to admins (or single socket)
 */
export async function broadcastOverdueStats(targetSocket = null) {
  if (!ioInstance && !targetSocket) return null;

  try {
    const now = new Date();
    const overdueCount = await IssuedBook.countDocuments({
      $or: [
        { status: "overdue" },
        { status: "borrowed", dueDate: { $lte: now } },
      ],
    });

    const payload = { overdueCount };

    if (targetSocket) {
      targetSocket.emit("admin:stats:overdue", payload);
      targetSocket.emit("stats:overdue", payload);
    } else {
      emitToAdmin("admin:stats:overdue", payload);
      emitToAdmin("stats:overdue", payload);
    }

    return payload;
  } catch (error) {
    console.error("[WebSocket] Error broadcasting overdue stats:", error?.message);
    return null;
  }
}

/**
 * Fetch and broadcast total reservation book counts to admins (or single socket)
 */
export async function broadcastReservationStats(targetSocket = null) {
  if (!ioInstance && !targetSocket) return null;

  try {
    const [activeReservations, expiredReservations, issuedReservations] = await Promise.all([
      ReserveBook.countDocuments({ status: "pending" }),
      ReserveBook.countDocuments({ status: "expired" }),
      ReserveBook.countDocuments({ status: "issued" }),
    ]);

    const totalReservations = activeReservations + expiredReservations + issuedReservations;

    const payload = {
      totalReservations,
      activeReservations,
      expiredReservations,
      issuedReservations,
    };

    if (targetSocket) {
      targetSocket.emit("admin:stats:reservations", payload);
      targetSocket.emit("stats:reservations", payload);
    } else {
      emitToAdmin("admin:stats:reservations", payload);
      emitToAdmin("stats:reservations", payload);
    }

    return payload;
  } catch (error) {
    console.error("[WebSocket] Error broadcasting reservation stats:", error?.message);
    return null;
  }
}
