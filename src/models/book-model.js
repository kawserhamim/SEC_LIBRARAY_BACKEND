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
                validator: function (authors) {
                    return (
                        Array.isArray(authors) &&
                        authors.length > 0 &&
                        authors.every(
                            (author) =>
                                typeof author === "string" &&
                                author.trim().length > 0
                        )
                    );
                },
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
                validator: function (isbn) {
                    // Supports ISBN-10 and ISBN-13 with or without hyphens
                    const normalized = isbn.replace(/[-\s]/g, "");

                    return (
                        /^(?:\d{9}[\dX]|\d{13})$/.test(normalized)
                    );
                },
                message: "Invalid ISBN format",
            },
        },

        coverImage: {
            url: {
                type: String,
                default: null,
                trim: true,
            },

            publicId: {
                type: String,
                default: null,
                trim: true,
            },
        },

        totalCopies: {
            type: Number,
            required: [true, "Total copies are required"],
            min: [0, "Total copies cannot be negative"],
            default: 0,
            validate: {
                validator: Number.isInteger,
                message: "Total copies must be an integer",
            },
        },

        availableCopies: {
            type: Number,
            required: [true, "Available copies are required"],
            min: [0, "Available copies cannot be negative"],
            default: 0,
            validate: {
                validator: Number.isInteger,
                message: "Available copies must be an integer",
            },
        },

        category: {
            type: String,
            enum: {
                values: BOOK_CATEGORIES,
                message: "Invalid book category",
            },
            default: "GENERAL",
            uppercase: true,
            trim: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

/*
|--------------------------------------------------------------------------
| Validation
|--------------------------------------------------------------------------
*/

bookSchema.pre("validate", async function () {
    if (this.availableCopies > this.totalCopies) {
        throw new Error(
            "Available copies cannot exceed total copies"
        );
    }
});

/*
|--------------------------------------------------------------------------
| Normalize ISBN before saving
|--------------------------------------------------------------------------
*/

bookSchema.pre("save", async function () {
    if (this.isModified("isbn")) {
        this.isbn = this.isbn.replace(/[-\s]/g, "");
    }
});

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

// Search/filter indexes
bookSchema.index({ title: 1 });
bookSchema.index({ category: 1 });
bookSchema.index({ authors: 1 });

// Text search
bookSchema.index({
    title: "text",
    authors: "text",
});

/*
|--------------------------------------------------------------------------
| Export
|--------------------------------------------------------------------------
*/

export const Book = mongoose.model("Book", bookSchema);