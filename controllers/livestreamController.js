import Livestream from '../models/Livestream.js';
import asyncHandler from "../middlewares/asyncHandler.js";
import ErrorResponse from "../utils/ErrorResponse.js";
import User from "../models/User.js";
import Course from "../models/Course.js";

// @desc      Get all livestreams
// @route     GET /api/v1/livestreams
// @access    Private
export const getLivestreams = asyncHandler(async (req, res, next) => {
    const livestreams = await Livestream.find().populate('courseId', 'title').populate('instructor', 'name');
    res.status(200).json({ success: true, count: livestreams.length, data: livestreams });
});

// @desc      Get single livestream
// @route     GET /api/v1/livestreams/:id
// @access    Private
export const getLivestream = asyncHandler(async (req, res, next) => {
    const livestream = await Livestream.findById(req.params.id).populate('courseId', 'title').populate('instructor', 'name');

    if (!livestream) {
        return next(new ErrorResponse(`Livestream not found with id of ${req.params.id}`, 404));
    }

    res.status(200).json({ success: true, data: livestream });
});

// @desc      Create new livestream
// @route     POST /api/v1/livestreams
// @access    Private
export const createLivestream = asyncHandler(async (req, res, next) => {
    // Add user to req.body
    const { instructorId, courseId, title, description } = req.body;
    console.log(req.body);
    // Kiểm tra xem có tồn tại instructorId và courseId không
    const instructor = await User.findById(instructorId);
    if (!instructor) {
        return next(new ErrorResponse(`Instructor not found with id of ${instructorId}`, 404));
    }
    const course = await Course.findById(courseId);
    if (!course) {
        return next(new ErrorResponse(`Course not found with id of ${courseId}`, 404));
    }
    if (course.instructor.toString() !== instructorId) {
        return next(new ErrorResponse(`Instructor ${instructorId} is not authorized to create livestream for this course`, 401
        ));
    }
    const livestream = await Livestream.create({
        instructor: instructorId,
        courseId,
        title,
        description: description ? description : ''
});

    res.status(201).json({
        success: true,
        data: livestream
    });
});

// @desc      Update livestream
// @route     PUT /api/v1/livestreams/:id
// @access    Private
export const updateLivestream = asyncHandler(async (req, res, next) => {
    let livestream = await Livestream.findById(req.params.id);

    if (!livestream) {
        return next(new ErrorResponse(`Livestream not found with id of ${req.params.id}`, 404));
    }

    // Make sure user is livestream owner
    if (livestream.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`User ${req.user.id} is not authorized to update this livestream`, 401));
    }

    livestream = await Livestream.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    res.status(200).json({ success: true, data: livestream });
});

// @desc      Delete livestream
// @route     DELETE /api/v1/livestreams/:id
// @access    Private
export const deleteLivestream = asyncHandler(async (req, res, next) => {
    const livestream = await Livestream.findById(req.params.id);

    if (!livestream) {
        return next(new ErrorResponse(`Livestream not found with id of ${req.params.id}`, 404));
    }

    // Make sure user is livestream owner
    if (livestream.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`User ${req.user.id} is not authorized to delete this livestream`, 401));
    }

    await livestream.remove();

    res.status(200).json({ success: true, data: {} });
});