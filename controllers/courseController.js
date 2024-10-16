import asyncHandler from 'express-async-handler';
import Course from '../models/Course.js';
import User from '../models/User.js';

// @desc    Create a new course
// @route   POST /api/courses
const createCourse = asyncHandler(async (req, res) => {
    const { courseId, title, description, instructor, level, price, modules } = req.body;
    const course = new Course({
        courseId,
        title,
        description,
        instructor,
        level,
        price,
        modules,
    });

    const createdCourse = await course.save();
    res.status(201).json(createdCourse);
});

// @desc    Get all courses
// @route   GET /api/courses
const getCourses = asyncHandler(async (req, res) => {
    const courses = await Course.find({});
    res.json(courses);
});
// @desc    Get course by ID
// @route   GET /api/courses/:id body: {userId}
const getCourseById = asyncHandler(async (req, res) => {
    const userId = req.query.userId;
    const user = await User.findById(userId);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    const course = await Course.findById(req.params.id);
    if (!course) {
        res.status(404);
        throw new Error('Course not found');
    }
    const instructor = await User.findById(course.instructor).select('profile');
    if (course && user.enrolled_courses.includes(course._id)) {
        
        res.json({
            isEnrolled: true,
            data: {
                ...course._doc,
                instructor: instructor
            }
        });
    } else if (course && !user.enrolled_courses.includes(course._id)) {
        res.json({
            isEnrolled: false,
            data: {
                ...course._doc,
                instructor: instructor
            }
        });
    }
});
// @desc    Update course by ID
// @route   PUT /api/courses/:id
const updateCourse = asyncHandler(async (req, res) => {
    const { courseId, title, description, instructor, level, price, modules } = req.body;
    const course = await Course.findById(req.params.id);
    if (course) {
        course.courseId = courseId;
        course.title = title;
        course.description = description;
        course.instructor = instructor;
        course.level = level;
        course.price = price;
        course.modules = modules;

        const updatedCourse = await course.save();
        res.json(updatedCourse);
    } else {
        res.status(404);
        throw new Error('Course not found');
    }
});
// @desc    Delete course by ID (Update isDeleted field to true)
// @route   DELETE /api/courses/:id
const deleteCourse = asyncHandler(async (req, res) => {
    const course = await Course.findById(req.params.id);
    if (course) {
        course.isDeleted = true;
        const updatedCourse = await course.save();
        res.json(updatedCourse);
    } else {
        res.status(404);
        throw new Error('Course not found');
    }
});

// @desc    Get courses by student ID
// @route   GET /api/courses/student/:id
const getCoursesByStudentId = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(id);
    if (user) {
        const courses = await Course.find({ _id: { $in: user.enrolled_courses } });
        if (!courses) {
            res.status(404);
            throw new Error('Courses not found');
        }
        res.json(courses);
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// @desc    Get courses by instructor ID
// @route   GET /api/courses/instructor/:id
const getCoursesByInstructorId = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        res.status(400);
        throw new Error('Instructor ID is required');
    }
    const courses = await Course.find({ instructor: id });
    if (!courses) {
        res.status(404);
        throw new Error('Courses not found');
    }
    res.json(courses);
});

export default { createCourse, getCourses, getCourseById, updateCourse, deleteCourse, getCoursesByStudentId, getCoursesByInstructorId };
