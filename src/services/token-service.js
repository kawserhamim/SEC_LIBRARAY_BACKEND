import jwt from "jsonwebtoken";

const COOKIE_NAME = "auth_token";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function signAuthToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "24h" }
  );
}

export function verifyAuthToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "none",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export function getAuthTokenFromCookie(req) {
  return req.cookies?.[COOKIE_NAME] || null;
}