import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

// Route imports
import userRegisterRoutes from "./routes/user-register-routes.js";
import adminRegisterRoutes from "./routes/admin-register-routes.js";
import adminAccessRoutes from "./routes/admin-access-route.js";
import studentAuthenticationRoutes from "./routes/student-authenticaton-route.js";
import userBookAccessRoutes from "./routes/user-book-access-route.js";
import notificationRoutes from "./routes/notification-routes.js";
import studentRagRoutes from "./routes/student-rag-routes.js";
import { upload } from "./controllers/student-rag-controller.js";

const app = express();

// ==========================================
// 1. Security & Header Middlewares
// ==========================================
app.disable("x-powered-by");
app.use(helmet());
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});

// ==========================================
// 2. CORS Configuration
// ==========================================
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.STUDENT_CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with matching origin or no origin (e.g. mobile/curl)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ==========================================
// 3. Document Indexing (RAG initialization)
// ==========================================
upload();

// ==========================================
// 4. Body Parsers & Cookie Parser
// ==========================================
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

// ==========================================
// 5. System Health Check
// ==========================================
app.get("/health", (req, res) => {
  res.send("<h1>API is healthy</h1>");
});

// ==========================================
// 6. Application API Routes
// ==========================================
app.use("/api/user", userRegisterRoutes);
app.use("/api/admin", adminRegisterRoutes);
app.use("/api/admin/access", adminAccessRoutes);
app.use("/api/main/student", studentAuthenticationRoutes);
app.use("/api/student/access", userBookAccessRoutes);
app.use("/api/student/rag", studentRagRoutes);
app.use("/api/student", notificationRoutes);

// ==========================================
// 7. 404 Catch-all Fallback Handler
// ==========================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

export default app;