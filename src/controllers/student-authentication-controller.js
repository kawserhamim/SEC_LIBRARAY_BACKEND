import StudentAuthentication from '../models/student-authentication-model.js';
import User from '../models/user-auth-models.js';
import TemporaryRegNo from '../models/TemporaryRegNo.js';

export const createStudentAuthentication = async (req, res) => {
    try {
        const { name, gmail, regNo, gender, Session, department } = req.body;





        if (!name || !gmail || !regNo || !gender || !Session || !department) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        const existingStudentAuthentication = await StudentAuthentication.findOne({ gmail });

        if (existingStudentAuthentication) {
            return res.status(409).json({
                success: false,
                message: 'Student authentication with this Gmail already exists'
            });
        }
        const existingRegNo = await StudentAuthentication.findOne({ regNo });

        if (existingRegNo) {
            return res.status(409).json({
                success: false,
                message: 'Student authentication with this registration number already exists'
            });
        }

        const existingName = await StudentAuthentication.findOne({ name });

        if (existingName) {
            return res.status(409).json({
                success: false,
                message: 'Student authentication with this name already exists'
            });
        }

        const newStudentAuthentication = new StudentAuthentication({
            name,
            gmail,
            regNo,
            gender,
            Session,
            department
        });

        const savedStudentAuthentication = await newStudentAuthentication.save();
        console.log('Student authentication created successfully:', savedStudentAuthentication);

        res.status(201).json({
            success: true,
            message: 'Student authentication created successfully',
            data: savedStudentAuthentication
        });
    } catch (error) {
        console.error('Error creating student authentication:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create student authentication data',
            error: error.message
        });
    }
};


export const getAllStudentAuthentications = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const skip = (page - 1) * limit;

        const totalStudents = await StudentAuthentication.countDocuments();

        const studentAuthentications = await StudentAuthentication.find()
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const pageCount = Math.ceil(totalStudents / limit);

        res.status(200).json({
            success: true,
            message: 'Student authentications retrieved successfully',
            data: studentAuthentications,
            pagination: {
                totalStudents,
                page,
                limit,
                pageCount,
                hasNextPage: page < pageCount,
                hasPreviousPage: page > 1
            }
        });

    } catch (error) {
        console.error('Error retrieving student authentications:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve student authentications',
            error: error.message
        });
    }
};

// export { createStudentAuthentication, getAllStudentAuthentications };



export const deleteStudentAuthentication = async (req, res) => {
    try {
        const { id } = req.params;

        const finds = await StudentAuthentication.findById(id);

        const findUserByRegNo = await User.findOne({ regNo: finds.regNo });

        const temporaryRegNo = new TemporaryRegNo({
            regNo: finds.regNo,
        });

        await temporaryRegNo.save();

        if (findUserByRegNo) {
            await User.findByIdAndDelete(findUserByRegNo._id);
        }



        const deletedStudentAuthentication =
            await StudentAuthentication.findByIdAndDelete(id);

        if (!deletedStudentAuthentication) {
            return res.status(404).json({
                success: false,
                message: "Student authentication not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Student authentication deleted successfully",
            data: deletedStudentAuthentication
        });

    } catch (error) {
        console.error("Error deleting student authentication:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete student authentication",
            error: error.message
        });
    }
};


export const searchStudentAuthentication = async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({
                success: false,
                message: "Search query is required"
            });
        }

        const searchResults = await StudentAuthentication.find({
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { gmail: { $regex: query, $options: 'i' } },
                { regNo: { $regex: query, $options: 'i' } }
            ]
        });

        res.status(200).json({
            success: true,
            message: "Search results retrieved successfully",
            data: searchResults
        });

    } catch (error) {
        console.error("Error searching student authentications:", error);

        res.status(500).json({
            success: false,
            message: "Failed to search student authentications",
            error: error.message        
        });
    }
};