import Livestream from '../models/Livestream';
import asyncHandler from "../middlewares/asyncHandler";
import ErrorResponse from "../utils/ErrorResponse";

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
    req.body.instructor = req.user.id;

    const livestream = await Livestream.create(req.body);

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