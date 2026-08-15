import mongoose from "mongoose";

const BORROW_DURATION_DAYS = 7;

const issuedBookSchema = new mongoose.Schema(
    {
        issuedId: {
            type: String,
            unique: true,
            index: true,
            immutable: true,
            default: () =>
                `IS-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
        },

        // Which book was issued
        book: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Book",
            required: [true, "Book is required"],
            index: true,
        },

        // ------------------------------
        // Book snapshot
        // (denormalized so reads do not
        // need to join the Book table
        // or break if the book record
        // is later edited/deleted)
        // ------------------------------

        bookTitle: {
            type: String,
            required: [true, "Book title is required"],
            trim: true,
        },

        bookAuthors: {
            type: [String],
            required: [true, "Book author(s) is required"],
            validate: {
                validator: function (authors) {
                    return (
                        Array.isArray(authors) &&
                        authors.length > 0 &&
                        authors.every(
                            (author) =>
                                typeof author === "string" &&
                                author.trim().length > 0,
                        )
                    );
                },
                message: "At least one valid book author is required",
            },
        },

        // Which student borrowed the book
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "User is required"],
            index: true,
        },

        // ------------------------------
        // Student snapshot
        // (denormalized so reads do not
        // need to join the User table)
        // ------------------------------

        userName: {
            type: String,
            required: true,
            trim: true,
        },

        userRegNo: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },

        userDepartment: {
            type: String,
            required: true,
            trim: true,
        },

        userSeason: {
            type: String,
            required: true,
            trim: true,
        },

        // When the book was borrowed
        borrowedAt: {
            type: Date,
            required: true,
            default: Date.now,
        },

        // Automatically calculated: borrowedAt + 7 days
        dueDate: {
            type: Date,
            required: true,
            default: function () {
                return new Date(
                    this.borrowedAt.getTime() +
                    BORROW_DURATION_DAYS * 24 * 60 * 60 * 1000,
                );
            },
            index: true,
        },

        // When the book was actually returned
        returnedAt: {
            type: Date,
            default: null,
        },

        status: {
            type: String,
            enum: ["borrowed", "returned", "overdue"],
            default: "borrowed",
            index: true,
        },

        // Optional reservation
        reservation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Reservation",
            default: null,
            index: true,
        },
    },
    {
        timestamps: true,
    },
);

/*
 * Student borrowing history
 */
issuedBookSchema.index({
    user: 1,
    borrowedAt: -1,
});

/*
 * Book borrowing history
 */
issuedBookSchema.index({
    book: 1,
    borrowedAt: -1,
});

/*
 * Efficient overdue queries
 */
issuedBookSchema.index({
    status: 1,
    dueDate: 1,
});

/*
 * Prevent the same student from
 * borrowing the same book twice
 * while the previous issue is active.
 */
issuedBookSchema.index(
    {
        book: 1,
        user: 1,
    },
    {
        unique: true,
        partialFilterExpression: {
            returnedAt: null,
        },
    },
);

export const IssuedBook = mongoose.model(
    "IssuedBook",
    issuedBookSchema,
);