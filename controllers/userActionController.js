import asyncHandler from "../middlewares/asyncHandler.js";
import User from "../models/User.js";
import ErrorResponse from "../utils/ErrorResponse.js";
import Course from "../models/Course.js";
import Progress from "../models/Progress.js";

// @desc Enroll in a course
// @route POST /api/v1/learns/:courseId/enroll
// @access Private
export const enrollCourse = asyncHandler(async (req, res, next) => {
    const courseId = req.params.courseId;
    const userId = req.user.id;

    // Find the course
    const course = await Course.findById(courseId);
    if (!course) {
        return next(new ErrorResponse(`No course found with id ${courseId}`, 404));
    }
     // Check if the user is already enrolled in the course
    const user = await User.findById(userId);
    if (user.enrolled_courses.includes(course._id)) {
        return next(new ErrorResponse(`User is already enrolled in the course`, 400));
    }
     // Enroll the user in the course
    user.enrolled_courses.push(course._id);
    await user.save();
    // Add the user to the course's enrolled users
    course.enrollmentCount += 1;
    await course.save();
    // Create a progress object for the user
    course.modules.forEach(async (module) => {
        const progress = new Progress({
            userId,
            courseId: course._id,
            moduleId: module._id,
        });
        await progress.save();
    });
    res.status(200).json({ success: true, data: 'Enrolled in the course' });

});

// @desc Get courses enrolled by userId
// @route GET /api/v1/users/:userId/enrolled-courses
// @access Private
export const getEnrolledCourses = asyncHandler(async (req, res, next) => {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if(!user) {
        return next(new ErrorResponse(`No user found with id ${userId}`, 404));
    }
    const courses = await Course.find({ _id: { $in: user.enrolled_courses } });
    res.status(200).json({ success: true, data: courses });
});

export default { enrollCourse, getEnrolledCourses };