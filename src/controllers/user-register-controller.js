import { registerUserSchema } from "../validators/register-validator.js";
import { loginUserSchema, changePasswordSchema } from "../validators/login-validator.js";
import { registerUser, loginUser, changePassword as changePasswordService } from "../services/user-register-service.js";
import {
  signAuthToken,
  setAuthCookie,
  clearAuthCookie,
} from "../services/token-service.js";
import User from "../models/user-auth-models.js";

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    regNo: user.regNo,
    email: user.email,
    phone: user.phone,
    department: user.department,
    Session: user.Session,
    gender: user.gender,
    role: user.role,
    fine: user.fine,
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
      message: "Resource already exists",
    });
  }

  const statusCode = error?.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? "Internal server error" : error.message,
  });
}

export const register = async (req, res) => {
  try {
    const data = registerUserSchema.parse(req.body);
    const user = await registerUser(data);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: { user: publicUser(user) },
    });
  } catch (error) {
    return handleError(res, error, "register");
  }
};

export const login = async (req, res) => {
  try {
    const data = loginUserSchema.parse(req.body);
    const user = await loginUser(data);

    const token = signAuthToken(user);
    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: { user: publicUser(user) },
    });
  } catch (error) {
    return handleError(res, error, "login");
  }
};

export const logout = async (req, res) => {
  try {
    clearAuthCookie(res);
    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    return handleError(res, error, "logout");
  }
};

export const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    return res.status(200).json({
      success: true,
      data: { user: publicUser(user) },
    });
  } catch (error) {
    return handleError(res, error, "me");
  }
};

export const changePassword = async (req, res) => {
  try {
    const data = changePasswordSchema.parse(req.body);
    await changePasswordService(req.user.id, data);

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    return handleError(res, error, "changePassword");
  }
};
