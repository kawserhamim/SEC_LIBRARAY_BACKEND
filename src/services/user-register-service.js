import bcrypt from "bcryptjs";
import User from "../models/user-auth-models.js";
import StudentAuthentication from "../models/student-authentication-model.js";

export async function registerUser(data) {
  const existing = await User.findOne({
    $or: [
      { email: data.email },
      { regNo: data.regNo },
      { phone: data.phone },
    ],
  }).lean();

  if (existing) {
    const err = new Error("User with this email, regNo, or phone already exists");
    err.statusCode = 409;
    throw err;
  }

  const studentAuth = await StudentAuthentication.findOne({
    gmail: data.email,
    regNo: data.regNo,
  }).lean();

  if (!studentAuth) {
    const err = new Error("your email or regNo is not found in the student authentication database");
    err.statusCode = 400;
    throw err;
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  return await User.create({
    name: data.name,
    regNo: data.regNo,
    email: data.email,
    phone: data.phone,
    password: passwordHash,
    department: data.department,
    Session: data.Session,
    gender: data.gender,
    role: "user",
  });
}

export async function loginUser(data) {
  const user = await User.findOne({ regNo: data.regNo }).select("+password");
  if (!user) {
    const err = new Error("Invalid regNo or password");
    err.statusCode = 401;
    throw err;
  }

  const ok = await bcrypt.compare(data.password, user.password);
  if (!ok) {
    const err = new Error("Invalid regNo or password");
    err.statusCode = 401;
    throw err;
  }

  return user;
}

export async function changePassword(userId, data) {
  const user = await User.findById(userId).select("+password");

  const isSame = await bcrypt.compare(data.newPassword, user.password);
  if (isSame) {
    const err = new Error("New password must be different from the old password");
    err.statusCode = 400;
    throw err;
  }

  user.password = await bcrypt.hash(data.newPassword, 12);
  await user.save();

  return user;
}
