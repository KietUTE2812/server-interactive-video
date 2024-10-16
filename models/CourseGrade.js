import mongoose from "mongoose";
import { Module } from "./Module.js";
import Assignment from "./Assignment.js";


const Schema = mongoose.Schema;

const CourseGradeSchema = new Schema({
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    assignments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Assignment'
    }],
    overallGrade: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Tạo index để tối ưu hóa truy vấn
CourseGradeSchema.index({ courseId: 1, userId: 1 }, { unique: true });

export default mongoose.model('CourseGrade', CourseGradeSchema);