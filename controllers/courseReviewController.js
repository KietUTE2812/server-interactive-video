import Course from '../models/Course.js';
import Review from '../models/CourseReview.js';
import asyncHandler from "../middlewares/asyncHandler.js";
import ErrorResponse from "../utils/ErrorResponse.js";

// @desc    Get all reviews
// @route   GET /api/reviews
// @access  Public
export const getReviews = asyncHandler(async (req, res, next) => {
    const reviews = await Review.find().populate('student', 'name').populate('course', 'title');
    res.status(200).json({ success: true, count: reviews.length, data: reviews });
});

// @desc    Get single review
// @route   GET /api/reviews/:id
// @access  Public
export const getReview = asyncHandler(async (req, res, next) => {
    const review = await Review.findById(req.params.id).populate('student', 'name').populate('course', 'title');

    if (!review) {
        return next(new ErrorResponse(`Review not found with id of ${req.params.id}`, 404));
    }

    res.status(200).json({ success: true, data: review });
});

// @desc    Add review
// @route   POST /api/courses/:courseId/reviews
// @access  Private
export const addReview = asyncHandler(async (req, res, next) => {
    req.body.course = req.params.courseId;
    req.body.student = req.user.id;

    const course = await Course.findById(req.params.courseId);

    if (!course) {
        return next(new ErrorResponse(`No course with the id of ${req.params.courseId}`, 404));
    }

    const review = await Review.create(req.body);

    res.status(201).json({
        success: true,
        data: review
    });
});

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private
export const updateReview = asyncHandler(async (req, res, next) => {
    let review = await Review.findById(req.params.id);

    if (!review) {
        return next(new ErrorResponse(`No review with the id of ${req.params.id}`, 404));
    }

    // Make sure review belongs to user or user is admin
    if (review.student.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`Not authorized to update review`, 401));
    }

    review = await Review.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    res.status(200).json({
        success: true,
        data: review
    });
});

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private
export const deleteReview = asyncHandler(async (req, res, next) => {
    const review = await Review.findById(req.params.id);

    if (!review) {
        return next(new ErrorResponse(`No review with the id of ${req.params.id}`, 404));
    }

    // Make sure review belongs to user or user is admin
    if (review.student.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`Not authorized to delete review`, 401));
    }

    await review.remove();

    res.status(200).json({
        success: true,
        data: {}
    });
});