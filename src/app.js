import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import userRegisterRoutes from "./routes/user-register-routes.js";
import adminRegisterRoutes from "./routes/admin-register-routes.js";
import adminAccessRoutes from "./routes/admin-access-route.js";
import studentAuthenticationRoutes from "./routes/student-authenticaton-route.js";
import userBookAccessRoutes from "./routes/user-book-access-route.js";
import notificationRoutes from "./routes/notification-routes.js";
import studentRagRoutes from "./routes/student-rag-routes.js";

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});
const allowedOrigins = [process.env.CLIENT_URL, process.env.STUDENT_CLIENT_URL].filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

// Health check
app.get("/health", (req, res) => {
  res.send("<h1>API is healthy</h1>");
});

// API Routes
app.use("/api/user", userRegisterRoutes);
app.use("/api/admin", adminRegisterRoutes);
app.use("/api/admin/access", adminAccessRoutes);
app.use("/api/main/student", studentAuthenticationRoutes);
app.use("/api/student/access", userBookAccessRoutes);
app.use("/api/student/rag", studentRagRoutes);
app.use("/api/student", notificationRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

export default app;