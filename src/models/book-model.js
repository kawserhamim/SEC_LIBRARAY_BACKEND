import mongoose from "mongoose";

const BOOK_CATEGORIES = [
  "CSE",
  "EEE",
  "CE",
  "PHYSICS",
  "CHEMISTRY",
  "GENERAL",
  "MATH",
  "ARTS",
  "HISTORY",
  "OTHERS",
];

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Book title is required"],
      trim: true,
      minlength: [1, "Book title cannot be empty"],
      maxlength: [300, "Book title cannot exceed 300 characters"],
    },
    authors: {
      type: [String],
      required: [true, "At least one author is required"],
      validate: {
        validator: (authors) =>
          Array.isArray(authors) &&
          authors.length > 0 &&
          authors.every((a) => typeof a === "string" && a.trim().length > 0),
        message: "At least one valid author is required",
      },
    },
    isbn: {
      type: String,
      required: [true, "ISBN is required"],
      unique: true,
      trim: true,
      uppercase: true,
      validate: {
        validator: (isbn) => /^(?:\d{9}[\dX]|\d{13})$/.test(isbn.replace(/[-\s]/g, "")),
        message: "Invalid ISBN format",
      },
    },
    coverImage: {
      url: { type: String, default: null, trim: true },
      publicId: { type: String, default: null, trim: true },
    },
    totalCopies: {
      type: Number,
      required: [true, "Total copies are required"],
      min: [0, "Total copies cannot be negative"],
      default: 0,
      validate: { validator: Number.isInteger, message: "Total copies must be an integer" },
    },
    availableCopies: {
      type: Number,
      required: [true, "Available copies are required"],
      min: [0, "Available copies cannot be negative"],
      default: 0,
      validate: { validator: Number.isInteger, message: "Available copies must be an integer" },
    },
    category: {
      type: String,
      enum: { values: BOOK_CATEGORIES, message: "Invalid book category" },
      default: "GENERAL",
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: null,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    // Grouped topics, e.g. { category: "Sorting Algorithms", subtopics: ["Quick Sort", "Merge Sort", "Bubble Sort"] }
    topics: {
      type: [
        {
          category: { type: String, required: true, trim: true },
          subtopics: { type: [String], default: [] },
          _id: false,
        },
      ],
      default: [],
    },
    aiEnrichment: {
      status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed"],
        default: "pending",
      },
      source: {
        type: String,
        enum: ["open_library", "google_books", "tavily", "llm_only", null],
        default: null,
      },
      confidence: {
        type: String,
        enum: ["high", "medium", "low", null],
        default: null,
      },
      model: { type: String, default: null },
      attempts: { type: Number, default: 0 },
      lastError: { type: String, default: null },
      generatedAt: { type: Date, default: null },
      // set on every status transition, independent of book.updatedAt (which
      // also changes on unrelated edits like availableCopies) — this is what
      // lets the stuck-job cron tell "genuinely stuck" apart from "recently touched"
      statusUpdatedAt: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Validation
bookSchema.pre("validate", async function () {
  if (this.availableCopies > this.totalCopies) {
    throw new Error("Available copies cannot exceed total copies");
  }
});

// Normalize ISBN before saving
bookSchema.pre("save", async function () {
  if (this.isModified("isbn")) {
    this.isbn = this.isbn.replace(/[-\s]/g, "");
  }
});

// Indexes
bookSchema.index({ title: 1 });
bookSchema.index({ category: 1 });
bookSchema.index({ authors: 1 });
bookSchema.index({ title: "text", authors: "text" }); //
bookSchema.index({ "aiEnrichment.status": 1 });

export const Book = mongoose.model("Book", bookSchema);