import Course from "../models/Course.js";
import { Module } from "../models/Module.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ErrorResponse from "../utils/ErrorResponse.js";
import User from '../models/User.js';
import mongoose from "mongoose";
import { filter } from "async";
export const getCourses = asyncHandler(async (req, res, next) => {
    let { search, userId, limit, page = 1, ...otherFilters } = req.query;
    const user = req.user;
    console.log('User:', user);

    if (user.role === 'instructor') {
        otherFilters.instructor = user._id;
    }
    if (user.role === 'student') {
        otherFilters.isApproved = true;
    }

    // Khởi tạo object filter cơ bản
    let filter = { status: 'published', ...otherFilters };
    if (otherFilters.tags) {
        otherFilters.tags = otherFilters.tags.split(',');
    }
    if (otherFilters.tags && Array.isArray(otherFilters.tags)) {
        filter.tags = { $all: otherFilters.tags };
    }
    if (otherFilters.level && otherFilters.level !== 'all') {
        filter.level = { $regex: otherFilters.level, $options: 'i' };
    }
    else if (otherFilters.level === 'all') {
        delete filter.level;
    }

    // Nếu có tham số search, tạo điều kiện tìm kiếm đa trường
    if (search) {
        filter = {
            ...filter,
            $or: [
                { title: { $regex: search, $options: 'i' } },
            ]
        };

        // Thêm tìm kiếm theo instructor
        const instructors = await User.find({
            $or: [
                { 'profile.fullName': { $regex: search, $options: 'i' } },
            ]
        }).select('_id');

        if (instructors.length > 0) {
            filter.$or.push({ instructor: { $in: instructors.map(i => i._id) } });
        }
    }

    console.log('Filter:', filter);
    // Đếm tổng số document thỏa mãn điều kiện
    const count = await Course.countDocuments(filter);

    // Thực hiện query với populate
    const courses = await Course.find(filter)
        .populate({
            path: 'instructor',
            select: 'email profile.fullName'
        })
        .populate({
            path: 'modules',
            select: 'index title moduleItems description',
            populate: {
                path: 'moduleItems',
                select: 'title content type'
            }
        })
        .populate({
            path: 'approvedBy',
            select: 'email profile.fullName'
        })
        .populate('reviewCount')
        .sort('createdAt')
        .limit(page * limit > count ? count - (page - 1) * limit : limit)
        .skip((page - 1) * limit);

    res.status(200).json({
        success: true,
        page: parseInt(page),
        limit: parseInt(limit),
        count,
        data: courses
    });
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
        .populate({
            path: 'modules',
            select: 'index title moduleItems description', // Lấy thêm moduleItems
            populate: {
                path: 'moduleItems', // Populate thêm thông tin của moduleItems
                select: 'title content type' // Chọn các trường cần thiết của moduleItems
            }
        })
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

export const getCourseByCourseId = asyncHandler(async (req, res, next) => {

    const course = await Course.findOne({ courseId: { $regex: new RegExp(`^${req.params.id}$`, 'i') } })
        .populate({
            path: 'instructor',
            select: 'email profile'
        })
        .populate({
            path: 'modules',
            select: 'index title moduleItems description', // Lấy thêm moduleItems
            populate: {
                path: 'moduleItems', // Populate thêm thông tin của moduleItems
                select: 'title content type' // Chọn các trường cần thiết của moduleItems
            }
        })
        .populate({
            path: 'approvedBy',
            select: 'email profile'
        })
        .populate('reviewCount');

    if (!course) {
        return next(new ErrorResponse(`Course not found with id of ${req.params.id}`, 404));
    }
    const userId = req.query?.userId;
    var isEnrolled = false;
    if (userId) {
        const user = await User.findById(userId)
        if (course && user.enrolled_courses.includes(course._id)) {
            isEnrolled = true;
        }

    }

    res.status(200).json({ success: true, data: course, isEnrolled });
});

// @desc    Get course by Instructor
// @route   GET /api/courses/:id query: {userId}
export const getCourseById = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    const course = await Course.findById(req.params.id).populate({
        path: 'modules',
        select: 'index title moduleItems description', // Lấy thêm moduleItems
        populate: {
            path: 'moduleItems', // Populate thêm thông tin của moduleItems
            select: 'title contentType type isGrade icon' // Chọn các trường cần thiết của moduleItems
        }
    }).populate({
        path: 'approvedBy',
        select: 'email profile'
    })
        .populate('reviewCount');
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
export const getCourseByInstructor = asyncHandler(async (req, res, next) => {
    const courses = await Course.find({ instructor: req.user._id })
        .populate({
            path: 'instructor',
            select: 'email profile.fullName'
        })
        .populate({
            path: 'modules',
            select: 'index title moduleItems description', // Lấy thêm moduleItems
            populate: {
                path: 'moduleItems', // Populate thêm thông tin của moduleItems
                select: 'title content type' // Chọn các trường cần thiết của moduleItems
            }
        })
        .populate({
            path: 'approvedBy',
            select: 'email profile.fullName'
        })
        .populate('reviewCount');

    if (!courses) {
        return next(new ErrorResponse(`Course not found with id of ${req.params.id}`, 404));
    }
    //console.log('Courses:', courses);
    res.status(200).json({ success: true, data: courses, count: courses.length });
});

// @desc      Create new course
// @route     POST /api/v1/courses
// @access    Private
export const createCourse = asyncHandler(async (req, res, next) => {
    console.log('Request user:', req.user);
    console.log('Request body:', req.body);
    const instructorId = req.user ? req.user.id : req.body.instructor;
    // if (!req.user) {
    //     return next(new ErrorResponse('User not authenticated', 401));
    // }
    // Add user to req.body
    //req.body.instructor = req.user.id;
    req.body.instructor = instructorId;

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
        return next(new ErrorResponse(`Course not found with id of ${req.params.id} err `, 404));
    }

    //Make sure user is course owner
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`User ${req.user.id} is not authorized to update this course`, 401));
    }

    // Bắt đầu session để đảm bảo tính nhất quán của dữ liệu
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // Cập nhật thông tin course
        const courseData = { ...req.body };
        //console.log("course updated1: ", courseData)
        delete courseData.modules; // Xóa modules khỏi courseData để tránh cập nhật trực tiếp

        course = await Course.findOneAndUpdate(
            { _id: req.params.id }, // Tìm course theo id
            courseData, // Dữ liệu mới để cập nhật course

            courseData,
            {
                new: true,
                runValidators: true,
                session
            }
        );

        //console.log("course updated: ", course)

        // Nếu có dữ liệu modules cần cập nhật
        if (req.body.modules && Array.isArray(req.body.modules)) {
            // Cập nhật từng module
            const modulePromises = req.body.modules.map(async (moduleData) => {
                if (moduleData._id) {
                    // Cập nhật module hiện có
                    const updatedModule = await Module.findByIdAndUpdate(
                        moduleData._id,
                        {
                            index: moduleData.index,
                            title: moduleData.title,
                            description: moduleData.description
                        },
                        {
                            new: true,
                            runValidators: true,
                            session
                        }
                    );

                    if (!updatedModule) {
                        throw new Error(`Module with id ${moduleData._id} not found`);
                    }

                    return updatedModule;
                } else {
                    // Tạo module mới
                    const newModule = await Module.create([{
                        courseId: course._id,
                        index: moduleData.index,
                        title: moduleData.title,
                        description: moduleData.description,
                        moduleItems: []
                    }], { session });

                    // Thêm module mới vào course
                    await Course.findByIdAndUpdate(
                        course._id,
                        {
                            $push: { modules: newModule[0]._id }
                        },
                        { session }
                    );

                    return newModule[0];
                }
            });

            // Chờ tất cả các thao tác module hoàn thành
            await Promise.all(modulePromises);

        }

        // Commit transaction
        await session.commitTransaction();

        // Lấy course đã được cập nhật với thông tin modules
        const updatedCourse = await Course.findOne({
            courseId: { $regex: new RegExp(`^${req.params.id}$`, 'i') }
        }).populate('modules');

        res.status(200).json({
            success: true,
            data: updatedCourse
        });

    } catch (error) {
        // Rollback nếu có lỗi
        await session.abortTransaction();
        return next(new ErrorResponse(error.message, 500));
    } finally {
        // Kết thúc session
        session.endSession();
    }
});

// // @desc      Delete course
// // @route     DELETE /api/v1/courses/:id
// // @access    Private
// export const deleteCourse = asyncHandler(async (req, res, next) => {
//     const course = await Course.findById(req.params.id);

//     if (!course) {
//         return next(new ErrorResponse(`Course not found with id of ${req.params.id}`, 404));
//     }

//     // Make sure user is course owner
//     if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
//         return next(new ErrorResponse(`User ${req.user.id} is not authorized to delete this course`, 401));
//     }

//     await course.remove();

//     res.status(200).json({ success: true, data: {} });
// });

// @desc      Approve course
// @route     PUT /api/v1/courses/:id/approve
// @access    Private
export const approveCourse = asyncHandler(async (req, res, next) => {
    const course = await Course.findById(req.params.id);
    req.body.approvedBy = req.user.id;
    if (!course) {
        return next(new ErrorResponse(`Course not found with id of ${req.params.id}`, 404));
    }

    // Make sure user is course owner
    if (req.user.role !== 'admin') {
        return next(new ErrorResponse(`User ${req.user.id} is not authorized to update this course`, 401));
    }

    course.isApproved = true;
    course.approvedBy = req.user.id;
    await course.save()

    res.status(200).json({ success: true, data: course });
});
