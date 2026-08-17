import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    regNo: { type: String, required: true, unique: true, trim: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, required: true, unique: true, trim: true, index: true },
    password: { type: String, required: true, select: false },
    gender: { type: String, required: true, enum: ["Male", "Female", "Hijra"] },
    department: { type: String, required: true, trim: true },
    Session: { type: String, required: true, trim: true },
    role: { type: String, required: true, default: "user", enum: ["user"] },
    fine: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;