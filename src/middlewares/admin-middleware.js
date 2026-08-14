import { verifyAuthToken, getAuthTokenFromCookie } from "../services/token-service.js";

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

    if (payload.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    req.user = {
      id: payload.sub,
      role: payload.role,
    };

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}
