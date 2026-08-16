import bcrypt from "bcryptjs";
import Admin from "../models/admin-model.js";

export async function loginAdmin(data) {
  const admin = await Admin.findOne({ regNo: data.regNo }).select("+password");


  if (!admin) {
    const err = new Error("Invalid credentials");
    err.statusCode = 401;
    throw err;
  }

  const ok = await bcrypt.compare(data.password, admin.password);
  if (!ok) {
    const err = new Error("Invalid credentials");
    err.statusCode = 401;
    throw err;
  }

  return admin;
}

export async function registerAdmin(data) {
  try {
    const existing = await Admin.findOne({
      $or: [{ email: data.email }, { regNo: data.regNo }],
    }).lean();

    if (existing) {
      const err = new Error("Admin with this email or registration number already exists");
      err.statusCode = 409;
      throw err;
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const admin = await Admin.create({
      name: data.name,
      email: data.email,
      regNo: data.regNo,
      password: passwordHash,
      role: "admin",
    });

    return admin;
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    throw error;
  }
}
