import mongoose from "mongoose";

const temporaryRegNoSchema = new mongoose.Schema({
  regNo: { type: String, required: true, unique: true, trim: true },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 60 * 60 * 1000),
    index: { expireAfterSeconds: 0 },
  },
});

const TemporaryRegNo = mongoose.model("TemporaryRegNo", temporaryRegNoSchema);

export default TemporaryRegNo;