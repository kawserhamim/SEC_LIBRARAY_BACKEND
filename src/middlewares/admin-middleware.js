import { verifyAuthToken, getAuthTokenFromCookie } from "../services/token-service.js";
import Admin from "../models/admin-model.js";

export function authenticateAdmin(req, res, next) {
  const token = getAuthTokenFromCookie(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Admin authentication required",
    });
  }

  try {
    const payload = verifyAuthToken(token);

    console.log("authenticateAdmin: token payload", payload);

    if (payload.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    req.user = {
      id: payload.id,
      role: payload.role,
    };

    next();
  } catch (error) {
    console.error("authenticateAdmin: token verification failed", error?.message);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}

// Loads the full admin document from the database using the
// verified token payload. Use this when a route handler needs
// the actual admin record (e.g. GET /api/admin/me).
export async function loadAdmin(req, res, next) {
  try {
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const admin = await Admin.findById(adminId);

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Admin account no longer exists",
      });
    }

    req.admin = admin;
    return next();
  } catch (error) {
    console.error("loadAdmin: failed to load admin", error);
    return res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
}
