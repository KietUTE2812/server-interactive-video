import Course from "../models/Course";
import asyncHandler from "../middlewares/asyncHandler";
import ErrorResponse from "../utils/ErrorResponse";

// @desc      Get all courses
// @route     GET /api/v1/courses
// @access    Public
export const getCourses = asyncHandler(async (req, res, next) => {
    const courses = await Course.find()
        .populate({
            path: 'instructor',
            select: 'email profile.fullName'
        })
        .populate('modules')
        .populate({
            path: 'approvedBy',
            select: 'email profile.fullName'
        })
        .populate('reviewCount');
    res.status(200).json({ success: true, count: courses.length, data: courses });
});

// @desc      Get single course
// @route     GET /api/v1/courses/:id
// @access    Public
export const getCourse = asyncHandler(async (req, res, next) => {
    const course = await Course.findById(req.params.id)
        .populate({
            path: 'instructor',
            select: 'email profile.fullName'
        })
        .populate('modules')
        .populate({
            path: 'approvedBy',
            select: 'email profile.fullName'
        })
        .populate('reviewCount');

    if (!course) {
        return next(new ErrorResponse(`Course not found with id of ${req.params.id}`, 404));
    }

    res.status(200).json({ success: true, data: course });
});

// @desc      Create new course
// @route     POST /api/v1/courses
// @access    Private
export const createCourse = asyncHandler(async (req, res, next) => {
    // Add user to req.body
    req.body.instructor = req.user.id;

    const course = await Course.create(req.body);

    res.status(201).json({
        success: true,
        data: course
    });
});
// @desc      Update course
// @route     PUT /api/v1/courses/:id
// @access    Private
export const updateCourse = asyncHandler(async (req, res, next) => {
    let course = await Course.findById(req.params.id);

    if (!course) {
        return next(new ErrorResponse(`Course not found with id of ${req.params.id}`, 404));
    }

    // Make sure user is course owner
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`User ${req.user.id} is not authorized to update this course`, 401));
    }

    course = await Course.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    res.status(200).json({ success: true, data: course });
});

// @desc      Delete course
// @route     DELETE /api/v1/courses/:id
// @access    Private
export const deleteCourse = asyncHandler(async (req, res, next) => {
    const course = await Course.findById(req.params.id);

    if (!course) {
        return next(new ErrorResponse(`Course not found with id of ${req.params.id}`, 404));
    }

    // Make sure user is course owner
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`User ${req.user.id} is not authorized to delete this course`, 401));
    }

    await course.remove();

    res.status(200).json({ success: true, data: {} });
});

// @desc      Approve course
// @route     PUT /api/v1/courses/:id/approve
// @access    Private
export const approveCourse = asyncHandler(async (req, res, next) => {
    let course = await Course.findById(req.params.id);
    req.body.approvedBy = req.user.id;
    if (!course) {
        return next(new ErrorResponse(`Course not found with id of ${req.params.id}`, 404));
    }

    // Make sure user is course owner
    if (req.user.role !== 'admin') {
        return next(new ErrorResponse(`User ${req.user.id} is not authorized to update this course`, 401));
    }

    course = await Course.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    res.status(200).json({ success: true, data: course });
});