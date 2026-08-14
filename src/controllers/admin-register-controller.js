import { registerAdminSchema, loginAdminSchema } from "../validators/admin-validator.js";
import { registerAdmin, loginAdmin } from "../services/admin-register-service.js";
import {
  signAuthToken,
  setAuthCookie,
  clearAuthCookie,
} from "../services/token-service.js";

function publicAdmin(admin) {
  return {
    id: admin._id,
    name: admin.name,
    email: admin.email,
    regNo: admin.regNo,
    role: admin.role,
  };
}

function handleError(res, error, label) {
  console.error(`${label} error:`, error);

  if (error?.name === "ZodError") {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.flatten().fieldErrors,
    });
  }

  if (error?.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Database validation failed",
    });
  }

  if (error?.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Admin with this email or regNo already exists",
    });
  }

  const statusCode = error?.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? "Internal server error" : error.message,
  });
}

export const registerAdminHandler = async (req, res) => {
  try {
    const data = registerAdminSchema.parse(req.body);
    const admin = await registerAdmin(data);

    return res.status(201).json({
      success: true,
      message: "Admin registered successfully",
      data: { admin: publicAdmin(admin) },
    });
  } catch (error) {
    return handleError(res, error, "admin register");
  }
};

export const loginAdminHandler = async (req, res) => {
  try {
    const data = loginAdminSchema.parse(req.body);
    const admin = await loginAdmin(data);

    const token = signAuthToken(admin);
    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      data: { admin: publicAdmin(admin) },
    });
  } catch (error) {
    return handleError(res, error, "admin login");
  }
};

export const logoutAdminHandler = async (req, res) => {
  try {
    clearAuthCookie(res);
    return res.status(200).json({
      success: true,
      message: "Admin logged out successfully",
    });
  } catch (error) {
    return handleError(res, error, "admin logout");
  }
};
