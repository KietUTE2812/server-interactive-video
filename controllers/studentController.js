import Course from "../models/Course.js";
import { Module } from "../models/Module.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ErrorResponse from "../utils/ErrorResponse.js";
import User from '../models/User.js';
import mongoose from "mongoose";
import ModuleProgress from "../models/Progress.js";

export const getStudentEnrollCourse = asyncHandler(async (req, res, next) => {
    const courseId = req.query.courseId;
    console.log("courseId", courseId);

    // First, find users enrolled in the course
    const users = await User.find({
        enrolled_courses: { $in: [new mongoose.Types.ObjectId(courseId)] }
    }).select('_id username email profile');
    if (!users) {
        return next(new ErrorResponse('No users found', 404));
    }
    // Then, find progress for these users in the specific course
    const progresses = await ModuleProgress.find({
        userId: { $in: users.map(user => user._id) },
        courseId: new mongoose.Types.ObjectId(courseId)
    }).populate('moduleId', 'title'); // Optional: populate module details
    if (!progresses) {
        return next(new ErrorResponse('No progress found', 404));
    }
    // Combine users and their progresses

    const result = users.map(user => {
        const userProgress = progresses.find(progress =>
            progress.userId.toString() === user._id.toString()
        );

        return {
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                profile: user.profile
            },
            progress: userProgress || null
        };
    });
    console.log("result", result);

    res.status(200).json({
        success: true,
        data: result
    });
});