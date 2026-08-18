import mongoose from "mongoose";

const researchPaperSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 500 },
    authors: [
      {
        name: { type: String, required: true, trim: true },
        affiliation: { type: String, trim: true },
        orcid: { type: String, trim: true },
      },
    ],
    abstract: { type: String, trim: true },
    category: {
      type: String,
      required: true,
      enum: ["CSE", "EEE", "CE", "ME", "PHYSICS", "CHEMISTRY", "MATH", "BIOLOGY", "GENERAL"],
    },
    keywords: [{ type: String, trim: true }],
    paperLink: { type: String, required: true, trim: true },
    publicationDate: { type: Date },
    journalName: { type: String, trim: true },
    conferenceName: { type: String, trim: true },
    doi: { type: String, trim: true, unique: true, sparse: true },
    isPublished: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    submittedBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
      name: { type: String, trim: true },
      email: { type: String, trim: true },
      regNo: { type: String, trim: true },
    },
    approvedBy: {
      adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
      approvedAt: { type: Date },
    },
    rejectedBy: {
      adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
      rejectedAt: { type: Date },
      reason: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

researchPaperSchema.index({
  title: "text",
  "authors.name": "text",
  abstract: "text",
  keywords: "text",
  journalName: "text",
  conferenceName: "text",
});
researchPaperSchema.index({ category: 1 });
researchPaperSchema.index({ "authors.name": 1 });
researchPaperSchema.index({ publicationDate: -1 });
researchPaperSchema.index({ status: 1 });
researchPaperSchema.index({ "submittedBy.userId": 1 });

const ResearchPaper = mongoose.model("ResearchPaper", researchPaperSchema);

export default ResearchPaper;