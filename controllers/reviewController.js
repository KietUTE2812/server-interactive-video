import Review from '../models/Review.js';
import asyncHandler from "express-async-handler";
import ErrorResponse from "../utils/ErrorResponse.js";
import User from "../models/User.js";

// @desc    Get all reviews
// @route   GET /api/v1/review
// @access  Public
const getReviews = asyncHandler(async (req, res, next) => {
    const {limit=10, page=1, ...filters} = req.query;

    const reviews = await Review.find(filters).limit(limit).skip(limit * (page-1)).sort({createdAt:-1}).populate('user', 'profile').populate('course', 'title');
    const count = await Review.countDocuments(filters);
    let rating = 0
    reviews.forEach(review => {
        rating += review.rating
    })
    res.status(200).json({ success: true, count: count, ovg:rating/reviews.length, data: reviews });
});

// @desc    Get single review 
// @route   GET /api/v1/review/:id
// @access  Public
const getReview = asyncHandler(async (req, res, next) => {
    const review = await Review.findById(req.params.id).populate('User', 'profile').populate('course', 'title');

    if (!review) {
        return next(new ErrorResponse(`Review not found with id of ${req.params.id}`), 404);
    }

    res.status(200).json({ success: true, data: review });
});

// @desc    Create new review
// @route   POST /api/v1/review
// @access  Private
const createReview = asyncHandler(async (req, res, next) => {
    const { rating, comment, courseId } = req.body;
    const review = await Review.create({
        rating,
        comment,
        course: courseId,
        user: req.user._id
    });

    const user = await User.findById(req.user._id).select('profile');
    review.user = user

    res.status(201).json({ success: true, data: review });
});

// @desc    Update review
// @route   PUT /api/v1/review/:id
// @access  Private
const updateReview = asyncHandler(async (req, res, next) => {
    let review = await Review.findById(req.params.id);

    if (!review) {
        return next(new ErrorResponse(`No review with the id of ${req.params.id}`, 404));
    }
    if (req.user.role === 'admin') {
        review = await Review.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        res.status(200).json({ success: true, data: review });
    }
    else if (review.user.toString() === req.user._id) {
        review = await Review.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        res.status(200).json({ success: true, data: review });
    }
    else {
        return next(new ErrorResponse(`Not authorized to update review`, 401));
    }

});

// @desc    Delete review
// @route   DELETE /api/v1/review/:id
// @access  Private
const deleteReview = asyncHandler(async (req, res, next) => {
    const review = await Review.findById(req.params.id);

    if (!review) {
        return next(new ErrorResponse(`No review with the id of ${req.params.id}`, 404));
    }

    if (review.user.toString() === req.user._id || req.user.role === 'admin') {
        await review.deleteOne();
        res.status(200).json({ success: true, data: {} });
    }
    else {
        return next(new ErrorResponse(`Not authorized to delete review`, 401));
    }
});

export default { getReviews, getReview, createReview, updateReview, deleteReview };