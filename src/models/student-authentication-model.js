import mongoose from 'mongoose';

const studentAuthenticationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },

    gmail: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },

    regNo: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },

    gender: {
        type: String,
        enum: ["Male", "Female", "Hijra"],
        required: true,
    },

    season: {
        type: String,
        required: true,
        trim: true,
    },

    department: {
        type: String,
        required: true,
        trim: true,
    },
},
    {
        timestamps: true,
    }
);

const StudentAuthentication = mongoose.model('StudentAuthentication', studentAuthenticationSchema);

export default StudentAuthentication;   