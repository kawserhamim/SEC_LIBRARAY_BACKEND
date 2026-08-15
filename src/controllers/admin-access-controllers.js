// =====================================================
// ADMIN ACCESS CONTROLLERS
// Beginner-friendly version.
//
// Connected to:
//   - routes/admin-access-route.js
//   - app.js  (mounted at /api/admin/access)
//   - models/user-auth-models.js
//   - models/book-model.js
//   - models/reserve-book.js
//   - models/issuebook-model.js
//   - queues/waitlist-queue.js
//   - middlewares/admin-middleware.js
//
// Every route already passed authenticateAdmin,
// so req.user is the logged-in admin.
// =====================================================

import { Book } from "../models/book-model.js";
import User from "../models/user-auth-models.js";
import { ReserveBook } from "../models/reserve-book.js";
import { IssuedBook } from "../models/issuebook-model.js";
import { enqueueWaitlistAvailability } from "../queues/waitlist-queue.js";
import { buildBookSearchFilter } from "../utils/book-search.js";

// =====================================================
// BOOK MANAGEMENT
// =====================================================

// POST /api/admin/access/books
// Admin adds a new book
export const addBook = async (req, res) => {
    try {
        const {
            title,
            authors,
            author,           // backward-compat: accept singular "author"
            isbn,
            totalCopies,
            availableCopies,
            category,
            coverImage,
        } = req.body;

        // 1. normalize authors into a non-empty array of trimmed strings
        const authorList = Array.isArray(authors)
            ? authors.map((a) => (typeof a === "string" ? a.trim() : "")).filter(Boolean)
            : typeof author === "string" && author.trim()
                ? [author.trim()]
                : [];

        // 2. normalize ISBN (strip hyphens/spaces, uppercase) to match how the
        //    Book model stores it (see pre-save hook in book-model.js)
        const normalizedIsbn =
            typeof isbn === "string" ? isbn.replace(/[-\s]/g, "").toUpperCase() : "";

        // 3. required-field check
        if (
            !title ||
            authorList.length === 0 ||
            !normalizedIsbn ||
            totalCopies === undefined ||
            availableCopies === undefined
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "title, at least one author, isbn, totalCopies and availableCopies are required",
            });
        }

        // 3a. type + range validation for copies (must be non-negative integers)
        if (
            typeof totalCopies !== "number" ||
            !Number.isInteger(totalCopies) ||
            totalCopies < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "totalCopies must be a non-negative integer",
            });
        }
        if (
            typeof availableCopies !== "number" ||
            !Number.isInteger(availableCopies) ||
            availableCopies < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "availableCopies must be a non-negative integer",
            });
        }
        if (availableCopies > totalCopies) {
            return res.status(400).json({
                success: false,
                message: "availableCopies cannot exceed totalCopies",
            });
        }

        // 4. duplicate ISBN check (against the normalized value)
        const existing = await Book.findOne({ isbn: normalizedIsbn });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: "Book already exists",
            });
        }

        // 5. save the book — match the Book schema shape exactly
        const book = await Book.create({
            title,
            authors: authorList,
            isbn: normalizedIsbn,
            totalCopies,
            availableCopies,
            category: category ? String(category).toUpperCase() : "GENERAL",
            ...(coverImage && (coverImage.url || coverImage.publicId)
                ? {
                    coverImage: {
                        url: coverImage.url ?? null,
                        publicId: coverImage.publicId ?? null,
                    },
                }
                : {}),
        });

        return res.status(201).json({
            success: true,
            message: "Book added successfully",
            book,
        });
    } catch (error) {
        // surface Mongoose validation errors as 400 instead of 500
        if (error && error.name === "ValidationError") {
            return res.status(400).json({
                success: false,
                message: "Invalid book data",
                error: error.message,
            });
        }

        return res.status(500).json({
            success: false,
            message: "Error adding book",
            error: error.message,
        });
    }
};


// PATCH /api/admin/access/books/:id
// Admin updates a book. All fields are optional; only the ones present in
// the request body are changed. Supports:
//   title, authors (array) / author (string), coverImage { url, publicId },
//   totalCopies, availableCopies, category, isbn.
export const updateBook = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            authors,
            author,            // backward-compat: accept singular "author"
            isbn,
            totalCopies,
            availableCopies,
            category,
            coverImage,
        } = req.body;

        // helper: only treat a value as "explicitly provided" when the key is
        // present in the JSON body. Using req.body.hasOwnProperty lets admins
        // send empty strings or 0 to clear / set those fields explicitly.
        const has = (k) => Object.prototype.hasOwnProperty.call(req.body, k);

        const setOps = {}; // top-level $set entries
        const unsetOps = {}; // $unset entries (e.g. clear coverImage)

        // --- title ---------------------------------------------------------
        if (has("title")) {
            if (typeof title !== "string" || !title.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "title must be a non-empty string",
                });
            }
            setOps.title = title.trim();
        }

        // --- authors -------------------------------------------------------
        if (has("authors") || has("author")) {
            let list;
            if (has("authors")) {
                if (!Array.isArray(authors)) {
                    return res.status(400).json({
                        success: false,
                        message: "authors must be an array of strings",
                    });
                }
                list = authors
                    .map((a) => (typeof a === "string" ? a.trim() : ""))
                    .filter(Boolean);
            } else {
                // singular "author" backward-compat
                list =
                    typeof author === "string" && author.trim()
                        ? [author.trim()]
                        : [];
            }

            if (list.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "At least one valid author is required",
                });
            }
            setOps.authors = list;
        }

        // --- isbn ----------------------------------------------------------
        if (has("isbn")) {
            if (typeof isbn !== "string" || !isbn.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "isbn must be a non-empty string",
                });
            }
            setOps.isbn = isbn.replace(/[-\s]/g, "").toUpperCase();
        }

        // --- totalCopies / availableCopies ---------------------------------
        if (has("totalCopies")) {
            if (
                typeof totalCopies !== "number" ||
                !Number.isInteger(totalCopies) ||
                totalCopies < 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "totalCopies must be a non-negative integer",
                });
            }
            setOps.totalCopies = totalCopies;
        }
        if (has("availableCopies")) {
            if (
                typeof availableCopies !== "number" ||
                !Number.isInteger(availableCopies) ||
                availableCopies < 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "availableCopies must be a non-negative integer",
                });
            }
            setOps.availableCopies = availableCopies;
        }

        // invariant: availableCopies cannot exceed totalCopies (only when
        // either side is being changed in this request, otherwise the
        // existing document state is used)
        if (setOps.availableCopies !== undefined || setOps.totalCopies !== undefined) {
            const existing = await Book.findById(id).select(
                "totalCopies availableCopies"
            );
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    message: "Book not found",
                });
            }
            const nextTotal =
                setOps.totalCopies !== undefined ? setOps.totalCopies : existing.totalCopies;
            const nextAvailable =
                setOps.availableCopies !== undefined
                    ? setOps.availableCopies
                    : existing.availableCopies;
            if (nextAvailable > nextTotal) {
                return res.status(400).json({
                    success: false,
                    message: "availableCopies cannot exceed totalCopies",
                });
            }
        }

        // --- category ------------------------------------------------------
        if (has("category")) {
            const allowed = [
                "CSE",
                "EEE",
                "CE",
                "PHYSICS",
                "CHEMISTRY",
                "GENERAL",
                "MATH",
                "ARTS",
            ];
            const normalized = String(category).toUpperCase();
            if (!allowed.includes(normalized)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid category. Allowed: ${allowed.join(", ")}`,
                });
            }
            setOps.category = normalized;
        }

        // --- coverImage ----------------------------------------------------
        // Supports three modes:
        //   1. { coverImage: { url, publicId } }  -> $set nested fields (partial OK)
        //   2. { coverImage: null }                -> $unset to clear
        if (has("coverImage")) {
            if (coverImage === null) {
                unsetOps["coverImage"] = "";
            } else if (typeof coverImage === "object") {
                if (has("url")) {
                    if (typeof coverImage.url === "string" && coverImage.url.trim()) {
                        setOps["coverImage.url"] = coverImage.url.trim();
                    } else {
                        setOps["coverImage.url"] = null;
                    }
                }
                if (has("publicId")) {
                    if (
                        typeof coverImage.publicId === "string" &&
                        coverImage.publicId.trim()
                    ) {
                        setOps["coverImage.publicId"] = coverImage.publicId.trim();
                    } else {
                        setOps["coverImage.publicId"] = null;
                    }
                }
            } else {
                return res.status(400).json({
                    success: false,
                    message:
                        "coverImage must be an object { url, publicId } or null to clear",
                });
            }
        }

        // nothing to update -> return current book unchanged
        if (Object.keys(setOps).length === 0 && Object.keys(unsetOps).length === 0) {
            const current = await Book.findById(id);
            if (!current) {
                return res.status(404).json({
                    success: false,
                    message: "Book not found",
                });
            }
            return res.status(200).json({
                success: true,
                message: "No changes applied",
                book: current,
            });
        }

        const updateDoc = {};
        if (Object.keys(setOps).length) updateDoc.$set = setOps;
        if (Object.keys(unsetOps).length) updateDoc.$unset = unsetOps;

        // runValidators + context:'query' so schema validators (min, integer,
        // enum, isbn format) and the pre("validate") hook fire on update.
        // Note: pre("validate") is only triggered on save() — for update we
        // already enforce the availableCopies <= totalCopies invariant above.
        const book = await Book.findByIdAndUpdate(id, updateDoc, {
            new: true,
            runValidators: true,
            context: "query",
        });

        if (!book) {
            return res.status(404).json({
                success: false,
                message: "Book not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Book updated",
            book,
        });
    } catch (error) {
        // Duplicate ISBN on edit (E11000)
        if (error && error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Another book already uses that ISBN",
            });
        }
        if (error && error.name === "ValidationError") {
            return res.status(400).json({
                success: false,
                message: "Invalid book data",
                error: error.message,
            });
        }
        // CastError from invalid ObjectId or non-integer number cast
        if (error && error.name === "CastError") {
            return res.status(400).json({
                success: false,
                message: `Invalid value for ${error.path}`,
            });
        }

        return res.status(500).json({
            success: false,
            message: "Error updating book",
            error: error.message,
        });
    }
};


// DELETE /api/admin/access/books/:id
// Admin deletes a book
export const deleteBook = async (req, res) => {
    try {
        const { id } = req.params;

        const book = await Book.findByIdAndDelete(id);
        if (!book) {
            return res.status(404).json({
                success: false,
                message: "Book not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Book deleted",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error deleting book",
            error: error.message,
        });
    }
};


// GET /api/admin/access/books
// Admin lists all books (simple pagination)
export const getBooksForAdmin = async (req, res) => {
    try {
        const offset = parseInt(req.query.offset) || 0;
        const limit = parseInt(req.query.limit) || 20;

        const totalBooks = await Book.countDocuments();

        const books = await Book.find()
            .select("title authors isbn totalCopies availableCopies category")
            .skip(offset)
            .limit(limit);

        const pageCount = Math.ceil(totalBooks / limit);

        return res.status(200).json({
            success: true,
            count: books.length,
            totalBooks,
            pageCount,
            offset,
            limit,
            data: books,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching books",
            error: error.message,
        });
    }
};


// GET /api/admin/access/books/search?query=...
// Admin searches books by title, authors, category, or ISBN
export const searchBook = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || !String(query).trim()) {
            return res.status(400).json({
                success: false,
                message: "Search query is required",
            });
        }

        const { filter, searchedFields } = buildBookSearchFilter(query);

        const books = await Book.find(filter).select(
            "title authors isbn totalCopies availableCopies category coverImage"
        );

        return res.status(200).json({
            success: true,
            query: String(query).trim(),
            searchedFields,
            count: books.length,
            data: books,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error searching books",
            error: error.message,
        });
    }
};





// DELETE /api/admin/access/students/:id
// Admin deletes a student by Mongo id
export const deleteStudent = async (req, res) => {
    try {
        const { id } = req.params;

        const student = await User.findByIdAndDelete(id);
        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Student deleted",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error deleting student",
            error: error.message,
        });
    }
};


// GET /api/admin/access/students
// Admin lists all students (simple pagination)
export const getAllStudent = async (req, res) => {
    try {
        const offset = parseInt(req.query.offset) || 0;
        const limit = parseInt(req.query.limit) || 20;

        const { department, Session } = req.query;

        const filter = {
            role: "user",
        };

        // Department filter
        if (department) {
            filter.department = department;
        }

        // Session filter
        if (Session) {
            filter.Session = Session;
        }

        const totalStudents = await User.countDocuments(filter);

        const students = await User.find(filter)
            .select("name email regNo Session department role")
            .skip(offset)
            .limit(limit);

        const pageCount = Math.ceil(totalStudents / limit);

        return res.status(200).json({
            success: true,
            count: students.length,
            totalStudents,
            pageCount,
            offset,
            limit,
            filters: {
                department: department || "all",
                Session: Session || "all",
            },
            data: students,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching students",
            error: error.message,
        });
    }
};


// POST /api/admin/access/students/search
// Admin searches a student by regNo
export const searchStudent = async (req, res) => {
    try {
        const { regNo } = req.body;
        if (!regNo) {
            return res.status(400).json({
                success: false,
                message: "regNo is required",
            });
        }

        const student = await User.findOne({ regNo }).select(
            "name email regNo Session department",
        );
        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found",
            });
        }

        const issuedBooks = await IssuedBook.find({ user: student._id })
            .populate("book", "title authors");

        const reservations = await ReserveBook.find({ user: student._id })
            .populate("book", "title authors");

        return res.status(200).json({
            success: true,
            student,
            issuedBooks,
            reservations,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error searching student",
            error: error.message,
        });
    }
};


// =====================================================
// ISSUE FLOW
// POST /api/admin/access/books/:bookId/issue/:reservationId
// Admin converts a pending reservation into an
// IssuedBook row.
// =====================================================
export const issueReservedBook = async (req, res) => {
    try {
        const { bookId, reservationId } = req.params;

        // 1. find the reservation
        const reservation = await ReserveBook.findById(reservationId);
        if (!reservation) {
            return res.status(404).json({
                success: false,
                message: "Reservation not found",
            });
        }
        if (reservation.status !== "pending") {
            return res.status(409).json({
                success: false,
                message: "Reservation is not pending",
            });
        }

        // 2. find the book
        const book = await Book.findById(bookId);
        if (!book) {
            return res.status(404).json({
                success: false,
                message: "Book not found",
            });
        }
        if (book.availableCopies <= 0) {
            return res.status(409).json({
                success: false,
                message: "No available copies",
            });
        }

        // 3. find the user
        const user = await User.findById(reservation.user);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // 4. check duplicate active issue
        const alreadyIssued = await IssuedBook.findOne({
            book: book._id,
            user: user._id,
            status: { $in: ["borrowed", "overdue"] },
        });
        if (alreadyIssued) {
            return res.status(409).json({
                success: false,
                message: "Student already borrowed this book",
            });
        }

        // 5. check borrowing limit (3 books)
        const borrowedCount = await IssuedBook.countDocuments({
            user: user._id,
            status: { $in: ["borrowed", "overdue"] },
        });
        if (borrowedCount >= 3) {
            return res.status(409).json({
                success: false,
                message: "Borrowing limit (3) reached",
            });
        }

        // 6. update book stock
        book.availableCopies -= 1;
        await book.save();

        // 7. mark reservation as issued
        reservation.status = "issued";
        await reservation.save();

        // 8. create IssuedBook (with book + student snapshots)
        const issuedBook = await IssuedBook.create({
            book: book._id,
            bookTitle: book.title,
            bookAuthors: book.authors,
            user: user._id,
            userName: user.name,
            userRegNo: user.regNo,
            userDepartment: user.department,
            userSession: user.Session,
            reservation: reservation._id,
        });

        return res.status(201).json({
            success: true,
            message: "Book issued successfully",
            data: issuedBook,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error issuing book",
            error: error.message,
        });
    }
};


// =====================================================
// ISSUE BOOK (direct, no reservation)
// POST /api/admin/access/books/:bookId/issue-to
// Admin issues a book directly to a student
// without requiring a prior reservation.
//
// The student's regNo MUST be sent in the JSON body:
//   Body: { "regNo": "2021-1-60-001" }
//
// The student's name, regNo, Session, department and the
// book's title + authors are snapshotted onto the
// IssuedBook row so they survive even if the source
// records are later edited or deleted.
// =====================================================
export const issueBookDirect = async (req, res) => {
    try {
        const { bookId } = req.params;
        const { regNo } = req.body || {};

        // 1. find the book
        const book = await Book.findById(bookId);
        if (!book) {
            return res.status(404).json({
                success: false,
                message: "Book not found",
            });
        }
        if (book.availableCopies <= 0) {
            return res.status(409).json({
                success: false,
                message:
                    "No available copies. Student should reserve or join the waitlist instead.",
            });
        }

        // 2. regNo is mandatory and comes from the JSON body.
        if (!regNo || !String(regNo).trim()) {
            return res.status(400).json({
                success: false,
                message: "regNo is required in the request body",
            });
        }

        const trimmedRegNo = String(regNo).trim();

        // 3. look up the student by regNo.
        const user = await User.findOne({ regNo: trimmedRegNo });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: `Student not found for regNo: ${trimmedRegNo}`,
            });
        }
        if (user.role && user.role !== "user") {
            return res.status(400).json({
                success: false,
                message: "Target account is not a student",
            });
        }

        // 3. duplicate active issue check
        const alreadyIssued = await IssuedBook.findOne({
            book: book._id,
            user: user._id,
            status: { $in: ["borrowed", "overdue"] },
        });
        if (alreadyIssued) {
            return res.status(409).json({
                success: false,
                message: "Student already borrowed this book",
            });
        }

        // 4. borrowing limit (3)
        const borrowedCount = await IssuedBook.countDocuments({
            user: user._id,
            status: { $in: ["borrowed", "overdue"] },
        });
        if (borrowedCount >= 3) {
            return res.status(409).json({
                success: false,
                message: "Borrowing limit (3) reached for this student",
            });
        }

        // 5. decrement stock
        book.availableCopies -= 1;
        await book.save();

        // 6. create IssuedBook (no reservation link, with snapshots)
        //    Snapshots taken at issue time so reports stay accurate
        //    even if the Book or User record is later edited/deleted.
        const issuedBook = await IssuedBook.create({
            book: book._id,
            bookTitle: book.title,
            bookAuthors: book.authors,
            user: user._id,
            userName: user.name,
            userRegNo: user.regNo,
            userDepartment: user.department,
            userSession: user.Session,
            reservation: null,
        });

        // 7. if stock dropped to 0, let waitlist worker decide
        if (book.availableCopies === 0) {
            enqueueWaitlistAvailability(book._id, 0);
        }

        return res.status(201).json({
            success: true,
            message: "Book issued successfully (direct)",
            data: issuedBook,
        });
    } catch (error) {
        // invalid ObjectId in params
        if (error && error.name === "CastError") {
            return res.status(400).json({
                success: false,
                message: `Invalid ${error.path}`,
            });
        }

        return res.status(500).json({
            success: false,
            message: "Error issuing book directly",
            error: error.message,
        });
    }
};


// =====================================================
// RETURN FLOW
// POST /api/admin/access/issued/:issuedId/return
// Admin marks an IssuedBook as returned and
// notifies waitlist.
// =====================================================
export const returnIssuedBook = async (req, res) => {
    try {
        const { issuedId } = req.params;

        // 1. find the issued book
        const issuedBook = await IssuedBook.findById(issuedId);
        if (!issuedBook) {
            return res.status(404).json({
                success: false,
                message: "Issued book not found",
            });
        }
        if (issuedBook.status === "returned") {
            return res.status(400).json({
                success: false,
                message: "Book already returned",
            });
        }

        // 2. mark as returned
        issuedBook.status = "returned";
        issuedBook.returnedAt = new Date();
        await issuedBook.save();

        // 3. increase stock
        const book = await Book.findByIdAndUpdate(
            issuedBook.book,
            { $inc: { availableCopies: 1 } },
            { new: true },
        );

        // 4. notify waitlist
        enqueueWaitlistAvailability(issuedBook.book, 1);

        return res.status(200).json({
            success: true,
            message: "Book returned successfully",
            issuedBook,
            book,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error returning book",
            error: error.message,
        });
    }
};


// =====================================================
// REPORTING
// =====================================================

// GET /api/admin/access/issued?status=borrowed&regNo=...&bookId=...
// Admin lists issued books (who borrowed what).
// The snapshot fields (userName, userRegNo, userDepartment,
// userSession, bookTitle, bookAuthors) are denormalized on
// the document so the response is always readable even
// if a referenced Book or User record is missing.
export const getIssuedBook = async (req, res) => {
    try {
        const { status, regNo, bookId } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (regNo) filter.userRegNo = regNo;
        if (bookId) filter.book = bookId;

        const issuedBooks = await IssuedBook.find(filter)
            .populate("book", "title authors")
            .populate("user", "name email regNo department Session")
            .sort({ borrowedAt: -1 });

        return res.status(200).json({
            success: true,
            count: issuedBooks.length,
            data: issuedBooks,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching issued books",
            error: error.message,
        });
    }
};


// GET /api/admin/access/reservations?status=pending&regNo=...&bookId=...
// Admin lists all reservations (who reserved what).
// The snapshot fields (user_name, user_regNo, user_department,
// user_Session, book_title, book_authors) are denormalized
// on the document so the response is always readable.
export const getAllReservation = async (req, res) => {
    try {
        const { status, regNo, bookId } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (regNo) filter.user_regNo = regNo;
        if (bookId) filter.book = bookId;

        const reservations = await ReserveBook.find(filter)
            .populate("book", "title authors")
            .populate("user", "name email regNo department Session")
            .sort({ reservedAt: -1 });

        return res.status(200).json({
            success: true,
            count: reservations.length,
            data: reservations,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching reservations",
            error: error.message,
        });
    }
};

// =====================================================
// DASHBOARD STATS (split into separate endpoints)
// The admin dashboard now hits four endpoints:
//   GET /api/admin/access/stats/users
//   GET /api/admin/access/stats/books
//   GET /api/admin/access/stats/issued
//   GET /api/admin/access/stats/reservations
// Each one returns a focused payload so the front-end
// can fetch and refresh sections independently.
// =====================================================

// GET /api/admin/access/stats/users
// Total registered users (all roles) and just students.
export const getUserStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalStudents = await User.countDocuments({ role: "user" });

        return res.status(200).json({
            success: true,
            message: "User stats fetched successfully",
            data: {
                totalUsers,
                totalStudents,
            },
        });
    } catch (error) {
        console.error("getUserStats error:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching user stats",
            error: error.message,
        });
    }
};


// GET /api/admin/access/stats/books
// Total book titles + aggregate copies
// (total, available, issued).
export const getBookStats = async (req, res) => {
    try {
        const totalBookTitles = await Book.countDocuments();

        const books = await Book.find().select("totalCopies availableCopies").lean();

        let totalCopies = 0;
        let availableCopies = 0;
        for (const book of books) {
            totalCopies += book.totalCopies;
            availableCopies += book.availableCopies;
        }
        const issuedCopies = Math.max(totalCopies - availableCopies, 0);

        return res.status(200).json({
            success: true,
            message: "Book stats fetched successfully",
            data: {
                totalBookTitles,
                totalCopies,
                availableCopies,
                issuedCopies,
            },
        });
    } catch (error) {
        console.error("getBookStats error:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching book stats",
            error: error.message,
        });
    }
};


// GET /api/admin/access/stats/issued
// Currently active issues (borrowed + overdue)
// plus lifetime returned count.
export const getIssueStats = async (req, res) => {
    try {
        const activeIssued = await IssuedBook.countDocuments({
            status: { $in: ["borrowed", "overdue"] },
        });
        const totalReturned = await IssuedBook.countDocuments({
            status: "returned",
        });
        const totalIssued = activeIssued + totalReturned;

        return res.status(200).json({
            success: true,
            message: "Issue stats fetched successfully",
            data: {
                totalIssued,
                activeIssued,
                totalReturned,
            },
        });
    } catch (error) {
        console.error("getIssueStats error:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching issue stats",
            error: error.message,
        });
    }
};


// GET /api/admin/access/stats/reservations
// Active vs expired reservations, with lifetime total.
export const getReservationStats = async (req, res) => {
    try {
        const activeReservations = await ReserveBook.countDocuments({
            status: "pending",
        });
        const expiredReservations = await ReserveBook.countDocuments({
            status: "expired",
        });
        const issuedReservations = await ReserveBook.countDocuments({
            status: "issued",
        });
        const totalReservations =
            activeReservations + expiredReservations + issuedReservations;

        return res.status(200).json({
            success: true,
            message: "Reservation stats fetched successfully",
            data: {
                totalReservations,
                activeReservations,
                expiredReservations,
                issuedReservations,
            },
        });
    } catch (error) {
        console.error("getReservationStats error:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching reservation stats",
            error: error.message,
        });
    }
};
