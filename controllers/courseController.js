import Course from "../models/Course.js";
import { Module } from "../models/Module.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ErrorResponse from "../utils/ErrorResponse.js";
import User from '../models/User.js';
import mongoose from "mongoose";
import { filter } from "async";
import ModuleProgress from "../models/Progress.js";
import minioClient from "../config/minioClient.js";

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
    delete filter.orderBy;
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
                {
                    title: { $regex: search, $options: 'i' }
                },
                {
                    tags: { $regex: search, $options: 'i' }
                },
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

    console.log('Filter:', filter.$or);
    // Đếm tổng số document thỏa mãn điều kiện
    const count = await Course.countDocuments(filter);

    // Thực hiện query với populate
    const courses = await Course.find(filter)
        .populate({
            path: 'instructor',
            select: 'email profile'
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
        .sort(otherFilters.orderBy == 'newest' ? { created_at: -1 } : { averageRating: -1 })// Sắp xếp theo số lượng review giảm dần, rating giảm dần, ngày tạo giảm dần
        .limit(page * limit > count ? count - (page - 1) * limit : limit)
        .skip((page - 1) * limit)
        ;

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
    const courseID = req.params.id;
    console.log('Course ID:', courseID);
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
    }).populate({
        path: 'instructor',
        select: 'email profile'
    }).populate('reviewCount');
    if (!course) {
        res.status(404);
        throw new Error('Course not found');
    }
    const enrollments = await User.countDocuments({ enrolled_courses: courseID });
    console.log('Enrollments:', enrollments);
    const instructor = await User.findById(course.instructor).select('email profile');
    if (course && user.enrolled_courses.includes(course._id)) {

        res.json({
            isEnrolled: true,
            enrollments: enrollments,
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
    //res.status(200).json({ success: true, data: courses, count: courses.length });

    const sortedCourses = courses.sort((a, b) =>
        a.title.localeCompare(b.title, 'vi', { sensitivity: 'base' })
    );

    res.status(200).json({
        success: true,
        data: sortedCourses,
        count: sortedCourses.length
    });
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
    console.log("video updated: ", req.file)
    console.log("course data: ", req.body)

    let course = await Course.findById(req.params.id);
    let urlVideo = "";

    if (!course) {
        return next(new ErrorResponse(`Course not found with id of ${req.params.id} err `, 404));
    }

    //Make sure user is course owner
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`User ${req.user.id} is not authorized to update this course`, 401));
    }
    // if (!req.file) {
    //     return next(new ErrorResponse('Please provide a file', 400));
    // }

    // Bắt đầu session để đảm bảo tính nhất quán của dữ liệu
    const session = await mongoose.startSession();
    session.startTransaction();

    if (req.file) {
        const bucketName = process.env.MINIO_BUCKET_NAME;
        const objectName = `${Date.now()}-${req.file.originalname}`;
        try {
            const bucketExists = await minioClient.bucketExists(bucketName);
            if (!bucketExists) {
                await minioClient.makeBucket(bucketName, 'us-east-1');
            }

            await minioClient.putObject(
                bucketName,
                objectName,
                req.file.buffer,
                req.file.size,
                { 'Content-Type': req.file.mimetype }
            );
        } catch (minioError) {
            await session.abortTransaction();
            console.error('MinIO upload error:', minioError);
            return next(new ErrorResponse('Error uploading file', 500));
        }
        urlVideo = `${process.env.MINIO_URL}/${objectName}`.toString();
    }
    try {

        // Cập nhật thông tin course
        console.log("video url: ", urlVideo)
        const courseData = {
            ...req.body,
            sumaryVideo: urlVideo
        };
        console.log("🔥 course data", courseData);

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


export const getAllCoursebyUser = asyncHandler(async (req, res, next) => {
    const userId = req.user.id;
    if (!userId) {
        res.status(404);
        throw new Error('User not found');
    }
    const user = await User.findById(userId).populate({
        path: 'enrolled_courses',
        select: '_id price courseId title description level photo averageRating courseReviews instructor',
        populate: {
            path: 'instructor', // Lấy thông tin giảng viên từ khóa học
            select: '_id fullname email profile'
        }
    });


    if (!user || !user.enrolled_courses) {
        res.status(404);
        throw new Error('No enrolled courses found');
    }


    const moduleProgresses = await ModuleProgress.find({
        userId: userId
    });

    // Kết hợp thông tin khóa học với tiến trình tương ứng
    const coursesWithProgress = user.enrolled_courses.map(course => {
        // Lọc tất cả tiến trình của khóa học hiện tại
        const courseProgress = moduleProgresses.filter(progress =>
            progress.courseId.toString() === course._id.toString()
        );

        // Tính toán tiến trình tổng thể của khóa học (nếu có)
        let overallProgress = 0;
        if (courseProgress.length > 0) {
            const totalCompletion = courseProgress.reduce((sum, progress) =>
                sum + progress.completionPercentage, 0);
            overallProgress = totalCompletion / courseProgress.length;
        }
        let status = "in-progress";
        if (overallProgress === 100) {
            status = 'completed';
        } else {
            status = 'in-progress';
        }

        // Trả về thông tin khóa học kèm tiến trình
        return {
            ...course.toObject(),
            progress: {
                overallPercentage: overallProgress,
                status: status,
                moduleDetails: courseProgress
            }
        };
    });

    res.status(200).json({
        success: true,
        count: coursesWithProgress.length,
        data: coursesWithProgress
    });

});