import Course from "../models/Course.js";
import { Module } from "../models/Module.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ErrorResponse from "../utils/ErrorResponse.js";
import User from '../models/User.js';
import mongoose from "mongoose";
import ModuleProgress from "../models/Progress.js";
import minio from "../utils/uploadToMiniO.js";
import dotenv from "dotenv";
import Progress from "../models/Progress.js";
dotenv.config();

import { getNotificationService } from "../services/notificationService.js";

/**
 * Các utilities hỗ trợ cho CourseController
 */

/**
 * Hàm xây dựng bộ lọc từ query parameters
 * @param {Object} queryParams - Query parameters từ request
 * @param {Object} user - Thông tin người dùng hiện tại
 * @returns {Object} filter - Bộ lọc dùng cho truy vấn MongoDB
 */
const buildCourseFilter = async (queryParams, user) => {
  const { search, tags, level, orderBy, page, limit, ...otherFilters } = queryParams;

  // Áp dụng bộ lọc cơ bản
  let filter = { status: 'published', ...otherFilters };
  // Áp dụng bộ lọc theo vai trò người dùng
  if (user?.role === 'instructor') {
    filter.instructor = user._id;
  }

  if (user?.role === 'student') {
    filter.isApproved = true;
  }

  if (user?.role === 'admin') {
    delete filter.status;
  }

  // Xử lý tags
  if (tags) {
    const tagArray = typeof tags === 'string' ? tags.split(',') : tags;
    filter.tags = { $all: tagArray };
  }

  // Xử lý level
  if (level && level !== 'all') {
    filter.level = { $regex: level, $options: 'i' };
  }

  // Xử lý tìm kiếm
  if (search) {
    filter = {
      ...filter,
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ]
    };

    // Tìm giảng viên phù hợp với từ khóa tìm kiếm
    const instructors = await User.find({
      $or: [
        { 'profile.fullName': { $regex: search, $options: 'i' } }
      ]
    }).select('_id');

    if (instructors.length > 0) {
      filter.$or.push({ instructor: { $in: instructors.map(i => i._id) } });
    }
  }
  return filter;
};

/**
 * Tạo response dạng phân trang chuẩn
 * @param {Array} data - Dữ liệu trả về
 * @param {number} page - Trang hiện tại
 * @param {number} limit - Số lượng mỗi trang
 * @param {number} total - Tổng số bản ghi
 * @returns {Object} - Response object chuẩn
 */
const createPaginatedResponse = (data, page, limit, total) => {
  return {
    success: true,
    page: parseInt(page || 1),
    limit: parseInt(limit || 10),
    totalPages: Math.ceil(total / parseInt(limit || 10)),
    total,
    data
  };
};

/**
 * Kiểm tra xác thực người dùng với khóa học
 * @param {string} courseId - ID của khóa học
 * @param {string} userId - ID của người dùng
 * @param {string} userRole - Vai trò của người dùng
 * @returns {Promise<boolean>} - Kết quả xác thực
 */
const validateCourseOwnership = async (courseId, userId, userRole) => {
  const course = await Course.findById(courseId);

  if (!course) {
    throw new ErrorResponse(`Course not found with id of ${courseId}`, 404);
  }

  // Cho phép admin hoặc người tạo khóa học
  if (userRole === 'admin' || course.instructor.toString() === userId) {
    return true;
  }

  throw new ErrorResponse(`User ${userId} is not authorized to perform this action`, 403);
};

// ------------------------------ Controllers ------------------------------

/**
 * @desc      Lấy danh sách khóa học với bộ lọc và phân trang
 * @route     GET /api/v1/learns
 * @access    Private
 */
export const getCourses = asyncHandler(async (req, res, next) => {
  const role = req.user?.role;
  let { page = 1, limit = 10, orderBy = 'newest', ...query } = req.query;
  const user = req.user;

  // Xây dựng bộ lọc từ query parameters
  const filter = await buildCourseFilter(req.query, user);

  // Đếm tổng số khóa học thỏa mãn điều kiện
  const total = await Course.countDocuments(filter);

  // Xác định trường sắp xếp
  const sortField = orderBy === 'newest'
    ? { createdAt: -1 }
    : { averageRating: -1 };

  // Thực hiện truy vấn chính với populate tối thiểu
  const courses = await Course.find(filter)
    .select('title description level price tags averageRating instructor status approvedBy isApproved reviewCount photo courseId')
    .populate('instructor', 'email profile')
    .populate('approvedBy', 'email profile.fullName')
    .populate('reviewCount')
    .sort(sortField)
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  if (role === 'user') {
    courses = courses.filter(course => course.isApproved);
  }

  // Trả về kết quả
  res.status(200).json(createPaginatedResponse(courses, page, limit, total));
});

/**
 * @desc      Lấy thông tin chi tiết của một khóa học
 * @route     GET /api/v1/learns/:id
 * @access    Private
 */
export const getCourseById = asyncHandler(async (req, res, next) => {
  const courseId = req.params.id;
  const userId = req.user?._id;

  // Tìm thông tin người dùng
  const user = await User.findById(userId);
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Tìm khóa học và populate các thông tin cần thiết
  const course = await Course.findById(courseId)
    .populate({
      path: 'modules',
      select: 'index title moduleItems description',
      populate: {
        path: 'moduleItems',
        select: 'title contentType type isGrade icon'
      }
    })
    .populate('approvedBy', 'email profile')
    .populate('instructor', 'email profile')
    .populate('reviewCount');

  if (!course) {
    return next(new ErrorResponse(`Course not found with id of ${courseId}`, 404));
  }

  // Đếm số người đăng ký
  const enrollments = await User.countDocuments({ enrolled_courses: courseId });

  // Kiểm tra người dùng đã đăng ký khóa học chưa
  const isEnrolled = user.enrolled_courses.includes(course._id);

  // Trả về response tương ứng
  res.status(200).json({
    success: true,
    isEnrolled,
    enrollments,
    data: course
  });
});

/**
 * @desc      Lấy khóa học theo courseId
 * @route     GET /api/v1/learns/courseId/:id
 * @access    Private
 */
export const getCourseByCourseId = asyncHandler(async (req, res, next) => {
  const courseIdParam = req.params.id;

  // Tìm khóa học theo courseId (không phải _id)
  const course = await Course.findOne({
    courseId: { $regex: new RegExp(`^${courseIdParam}$`, 'i') }
  })
    .populate('instructor', 'email profile')
    .populate({
      path: 'modules',
      select: 'index title moduleItems description',
      populate: {
        path: 'moduleItems',
        select: 'title content type'
      }
    })
    .populate('approvedBy', 'email profile')
    .populate('reviewCount');

  if (!course) {
    return next(new ErrorResponse(`Course not found with courseId of ${courseIdParam}`, 404));
  }

  // Kiểm tra người dùng đã đăng ký chưa (nếu có userId trong query)
  let isEnrolled = false;
  const userId = req.query?.userId;

  if (userId) {
    const user = await User.findById(userId);
    if (user && course && user.enrolled_courses.includes(course._id)) {
      isEnrolled = true;
    }
  }

  res.status(200).json({
    success: true,
    data: course,
    isEnrolled
  });
});

/**
 * @desc      Lấy danh sách khóa học của giảng viên
 * @route     GET /api/v1/learns/instructor
 * @access    Private (Instructor, Admin)
 */
export const getCourseByInstructor = asyncHandler(async (req, res, next) => {
  // Tìm tất cả khóa học của giảng viên hiện tại
  const courses = await Course.find({ instructor: req.user._id })
    .select('title description level price tags averageRating status isApproved courseId photo created_at')
    .populate('instructor', 'email profile.fullName')
    .populate('approvedBy', 'email profile.fullName')
    .populate('reviewCount');

  if (!courses) {
    return next(new ErrorResponse('No courses found for this instructor', 404));
  }

  // Sắp xếp khóa học theo tiêu đề (hỗ trợ tiếng Việt)
  const sortedCourses = courses.sort((a, b) =>
    a.title.localeCompare(b.title, 'vi', { sensitivity: 'base' })
  );

  res.status(200).json({
    success: true,
    count: sortedCourses.length,
    data: sortedCourses
  });
});

/**
 * @desc      Tạo mới khóa học
 * @route     POST /api/v1/learns
 * @access    Private (Instructor, Admin)
 */
export const createCourse = asyncHandler(async (req, res, next) => {
  // Validate đầu vào
  const { title, description } = req.body;
  const notificationService = getNotificationService();

  if (!title || title.trim() === '') {
    return next(new ErrorResponse('Title is required', 400));
  }

  if (!description || description.trim() === '') {
    return next(new ErrorResponse('Description is required', 400));
  }

  // Thêm ID người tạo khóa học
  const instructorId = req.user.id;
  const courseData = {
    ...req.body,
    instructor: instructorId,
    tags: req.body.tags.split(',')
  };
  // Upload video nếu có
  if (req.files) {
    if (req.files.sumaryVideo[0]) {
      const videoFile = req.files.sumaryVideo[0];
      try {
        const videoName = Date.now() + '_' + videoFile.originalname;
        const videoUrl = await minio.uploadStream(videoName, videoFile.buffer, videoFile.size);
        courseData.sumaryVideo = `${process.env.MINIO_URL}/${videoUrl.objectName}`;
      } catch (error) {
        return next(new ErrorResponse(`File upload failed: ${error.message}`, 500));
      }
    }

    else {
      return res.status(400).json({
        success: false,
        message: 'No files sumaryVideo uploaded'
      });
    }
    if (req.files?.photo && req.files?.photo[0]) {
      const photoFile = req.files.photo[0];
      try {
        const photoName = Date.now() + '_' + photoFile.originalname;
        const photoUrl = await minio.uploadStream(photoName, photoFile.buffer, photoFile.size);
        courseData.photo = `${process.env.MINIO_URL}/${photoUrl.objectName}`;
      } catch (error) {
        return next(new ErrorResponse(`File upload failed: ${error.message}`, 500));
      }
    }
  }

  // Tạo khóa học mới
  const course = await Course.create(courseData);

  // Tạo thông báo hệ thống cho admin
  const admin = await User.find({ role: 'admin' });
  if (admin) {
    await notificationService.sendUserNotification(admin._id, {
      title: `New course created: ${course.title}`,
      message: `New course created: ${course.title} by ${instructorId}`,
      isSystem: true
    });
  }


  res.status(201).json({
    success: true,
    data: course
  });
});

/**
 * @desc      Cập nhật khóa học
 * @route     PUT /api/v1/learns/:id
 * @access    Private (Instructor, Admin)
 */
export const updateCourse = asyncHandler(async (req, res, next) => {
  const courseId = req.params.id;
  const userId = req.user.id;
  const course = await Course.findById(courseId);
  // Bắt đầu session transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Kiểm tra quyền cập nhật khóa học
    await validateCourseOwnership(courseId, userId, req.user.role);

    // Chuẩn bị dữ liệu cập nhật
    const courseData = { ...req.body };
    delete courseData.modules; // Xử lý riêng modules

    // Upload video nếu có
    if (req.files) {
      if (req?.files?.sumaryVideo) {
        const videoFile = req.files.sumaryVideo[0];
        try {
          const videoName = Date.now() + '_' + videoFile.originalname;
          const videoUrl = await minio.uploadStream(videoName, videoFile.buffer, videoFile.size);
          courseData.sumaryVideo = `${process.env.MINIO_URL}/${videoUrl.objectName}`;
        } catch (error) {
          return next(new ErrorResponse(`File upload failed: ${error.message}`, 500));
        }
      }
      if (req?.files?.photo) {
        const photoFile = req.files.photo[0];
        try {
          const photoName = Date.now() + '_' + photoFile.originalname;
          const photoUrl = await minio.uploadStream(photoName, photoFile.buffer, photoFile.size);
          courseData.photo = `${process.env.MINIO_URL}/${photoUrl.objectName}`;
        } catch (error) {
          return next(new ErrorResponse(`File upload failed: ${error.message}`, 500));
        }
      }
    }

    // Cập nhật khóa học
    const updatedCourse = await Course.findByIdAndUpdate(
      courseId,
      courseData,
      {
        new: true,
        runValidators: true,
        session
      }
    );

    // Cập nhật các modules nếu có
    if (req.body.modules) {
      const modules = JSON.parse(req.body.modules);
      // Xử lý từng module một
      await Promise.all(modules.map(async (moduleData) => {
        if (moduleData._id) {
          // Cập nhật module hiện có
          const module = await Module.findById(moduleData._id);

          if (!module) {
            throw new ErrorResponse(`Module with id ${moduleData._id} not found`, 404);
          }

          // Chỉ cập nhật các trường cần thiết
          await Module.findByIdAndUpdate(
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
        } else {
          // Tạo module mới
          const newModule = await Module.create([{
            courseId: updatedCourse._id,
            index: moduleData.index,
            title: moduleData.title,
            description: moduleData.description,
            moduleItems: []
          }], { session });

          // Thêm module mới vào khóa học
          await Course.findByIdAndUpdate(
            updatedCourse._id,
            { $push: { modules: newModule[0]._id } },
            { session }
          );
        }
      }));
    }

    // Commit transaction
    await session.commitTransaction();

    // Lấy thông tin đầy đủ của khóa học đã cập nhật
    const finalCourse = await Course.findById(courseId)
      .populate({
        path: 'modules',
        select: 'index title moduleItems description',
        populate: {
          path: 'moduleItems',
          select: 'title content type'
        }
      });

    res.status(200).json({
      success: true,
      data: finalCourse
    });

  } catch (error) {
    // Rollback transaction nếu có lỗi
    await session.abortTransaction();
    return next(error);
  } finally {
    // Kết thúc session
    session.endSession();
  }
});

/**
 * @desc      Phê duyệt khóa học
 * @route     PUT /api/v1/learns/:id/approve
 * @access    Private (Admin)
 */
export const approveCourse = asyncHandler(async (req, res, next) => {
  const { isApproved, feedback } = req.body;
  const notificationService = getNotificationService();
  // Chỉ admin mới có quyền phê duyệt
  if (req.user.role !== 'admin') {
    return next(new ErrorResponse(`User ${req.user.id} is not authorized to approve courses`, 403));
  }

  const course = await Course.findById(req.params.id);

  if (!course) {
    return next(new ErrorResponse(`Course not found with id of ${req.params.id}`, 404));
  }

  if (isApproved) {
    course.isApproved = true;
    course.approvedBy = req.user.id;
    await course.save();
    await notificationService.sendUserNotification(course.instructor, {
      title: `Course approved: ${course.title}`,
      message: `Course approved: ${course.title} by ${req.user.id}`,
    });
  }
  else {
    course.isApproved = false;
    await course.save();
    await notificationService.sendUserNotification(course.instructor, {
      title: `Course rejected: ${course.title}`,
      message: `Course rejected: ${course.title} because of ${feedback}`,
    });
  }

  res.status(200).json({
    success: true,
    data: course
  });
});

/**
 * @desc      Lấy tất cả khóa học đã đăng ký của người dùng
 * @route     GET /api/v1/learns/my-learning
 * @access    Private (Student, Admin)
 */
// export const getAllCoursebyUser = asyncHandler(async (req, res, next) => {
//   const userId = req.user._id;

//   // Tìm thông tin người dùng và các khóa học đã đăng ký
//   const user = await User.findById(userId)
//     .populate({
//       path: 'enrolled_courses',
//       select: '_id price courseId title description level photo averageRating courseReviews instructor',
//       populate: {
//         path: 'instructor',
//         select: '_id fullname email profile'
//       }
//     });

//   if (!user) {
//     return next(new ErrorResponse('User not found', 404));
//   }

//   if (!user.enrolled_courses || user.enrolled_courses.length === 0) {
//     return res.status(200).json({
//       success: true,
//       count: 0,
//       data: []
//     });
//   }

//   // Lấy tiến trình học tập của người dùng
//   const moduleProgresses = await ModuleProgress.find({ userId });

//   // Kết hợp thông tin khóa học với tiến trình học tập
//   const coursesWithProgress = user.enrolled_courses.map(course => {
//     // Lọc tiến trình của khóa học hiện tại
//     const courseProgress = moduleProgresses.filter(progress =>
//       progress.courseId.toString() === course._id.toString()
//     );

//     // Tính toán tiến trình tổng thể
//     let overallProgress = 0;
//     if (courseProgress.length > 0) {
//       const totalCompletion = courseProgress.reduce((sum, progress) =>
//         sum + progress.completionPercentage, 0);
//       overallProgress = totalCompletion / courseProgress.length;
//     }

//     // Xác định trạng thái khóa học
//     const status = overallProgress === 100 ? 'completed' : 'in-progress';

//     // Trả về thông tin khóa học với tiến trình
//     return {
//       ...course.toObject(),
//       progress: {
//         overallPercentage: overallProgress,
//         status,
//         moduleDetails: courseProgress
//       }
//     };
//   });

//   res.status(200).json({
//     success: true,
//     count: coursesWithProgress.length,
//     data: coursesWithProgress
//   });
// });
export const getAllCoursebyUser = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  // Tìm thông tin người dùng và các khóa học đã đăng ký
  const user = await User.findById(userId)
    .populate({
      path: 'enrolled_courses',
      select: '_id price courseId title description level photo averageRating courseReviews instructor',
      populate: {
        path: 'instructor',
        select: '_id fullname email profile'
      }
    });

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  if (!user.enrolled_courses || user.enrolled_courses.length === 0) {
    return res.status(200).json({
      success: true,
      count: 0,
      data: []
    });
  }

  // Lấy tất cả progress của user một lần để tối ưu performance
  const courseIds = user.enrolled_courses.map(course => course._id);
  const allProgress = await Progress.find({
    userId,
    courseId: { $in: courseIds }
  })
    .populate({
      path: "moduleItemProgresses.moduleItemId",
      select: "title type description duration video quiz programming",
    })
    .populate("moduleId", "title index");

  // Group progress theo courseId
  const progressByCourse = {};
  allProgress.forEach(progress => {
    const courseId = progress.courseId.toString();
    if (!progressByCourse[courseId]) {
      progressByCourse[courseId] = [];
    }
    progressByCourse[courseId].push(progress);
  });

  // Định nghĩa trọng số
  const ITEM_WEIGHTS = {
    lecture: 3,
    quiz: 2,
    programming: 4,
    supplement: 1,
  };

  // Function để tính weighted progress
  const calculateWeightedProgress = (courseProgress) => {
    if (!courseProgress || courseProgress.length === 0) {
      return {
        percentage: 0,
        details: {
          totalWeight: 0,
          completedWeight: 0,
          totalItems: 0,
          completedItems: 0
        }
      };
    }

    let totalWeight = 0;
    let completedWeight = 0;
    let totalModuleItems = 0;
    let completedModuleItems = 0;

    courseProgress.forEach((moduleProgress) => {
      moduleProgress.moduleItemProgresses.forEach((itemProgress) => {
        totalModuleItems++;

        const moduleItem = itemProgress.moduleItemId;
        const itemType =
          moduleItem?.type ||
          (moduleItem?.video ? "lecture" :
            moduleItem?.quiz ? "quiz" :
              moduleItem?.programming ? "programming" : "supplement");

        const weight = ITEM_WEIGHTS[itemType] || 1;
        totalWeight += weight;

        if (itemProgress.status === "completed") {
          completedModuleItems++;
          completedWeight += weight;
        } else if (itemProgress.completionPercentage > 0) {
          const partialWeight = (weight * itemProgress.completionPercentage) / 100;
          completedWeight += partialWeight;
        }
      });
    });

    const percentage = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

    return {
      percentage,
      details: {
        totalWeight,
        completedWeight: parseFloat(completedWeight.toFixed(2)),
        totalItems: totalModuleItems,
        completedItems: completedModuleItems
      }
    };
  };

  // Tính progress cho từng course
  const coursesWithProgress = user.enrolled_courses.map(course => {
    const courseId = course._id.toString();
    const courseProgress = progressByCourse[courseId] || [];

    const progressResult = calculateWeightedProgress(courseProgress);
    const overallProgress = progressResult.percentage;

    const status = overallProgress === 100 ? 'completed' :
      overallProgress > 0 ? 'in-progress' : 'not-started';

    return {
      ...course.toObject(),
      progress: {
        overallPercentage: overallProgress,
        status,
        weightedCompletion: progressResult.details,
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
/**
 * @desc      Xóa khóa học (Soft delete)
 * @route     DELETE /api/v1/learns/:id
 * @access    Private (Instructor, Admin)
 */
export const deleteCourse = asyncHandler(async (req, res, next) => {
  const courseId = req.params.id;
  const userId = req.user.id;

  try {
    // Kiểm tra quyền xóa khóa học
    await validateCourseOwnership(courseId, userId, req.user.role);

    // Soft delete - cập nhật trạng thái thành 'deleted'
    await Course.findByIdAndUpdate(courseId, { status: 'deleted' });

    res.status(200).json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    return next(error);
  }
});

export const getCourseStats = asyncHandler(async (req, res, next) => {
  const courses = await Course.find({});
  const totalCourses = courses.length;
  const totalEnrollments = courses.reduce((sum, course) => sum + course.enrollments, 0);
  const totalRevenue = courses.reduce((sum, course) => sum + course.price, 0);
  const pendingCourses = courses.filter(course => course.isAprroved === false);
  const publishedCourses = courses.filter(course => course.status === 'published');
  const unpublishedCourses = courses.filter(course => course.status !== 'published');
  const popularCourses = courses.sort((a, b) => b.enrollments - a.enrollments).slice(0, 5);


  res.status(200).json({
    success: true,
    data: { totalCourses, totalEnrollments, totalRevenue, pendingCourses, publishedCourses, unpublishedCourses, popularCourses }
  });
});

export const getCertificate = asyncHandler(async (req, res, next) => {
  const courseId = req.params.id;
  const userId = req.user.id;

  const user = await User.findById(userId);
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  const certificate = user.certificate.find((cert) => cert.course.toString() === courseId);
  if (!certificate) {
    return res.status(200).json({
      success: true,
      message: 'No certificate found for this course',
      data: null
    });
  }
  res.status(200).json({
    success: true,
    message: 'Certificate retrieved successfully',
    data: certificate
  });
})

/**
 * @desc      Tạo chứng chỉ cho học viên hoàn thành khóa học
 * @route     POST /api/v1/learns/certificate/:id
 * @access    Private (Student)
 */
export const createCertificate = asyncHandler(async (req, res, next) => {
  const courseId = req.params.id;
  const userId = req.user._id;

  try {
    // Kiểm tra khóa học
    const course = await Course.findById(courseId);
    if (!course) {
      return next(new ErrorResponse('Course not found', 404));
    }

    // Kiểm tra người dùng
    const user = await User.findById(userId);
    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    // Kiểm tra user đã đăng ký khóa học chưa
    const isEnrolled = user.enrolled_courses.includes(courseId);
    if (!isEnrolled) {
      return next(new ErrorResponse('You are not enrolled in this course', 403));
    }

    // Kiểm tra file certificate
    if (!req?.file) {
      return next(new ErrorResponse('Certificate file is required', 400));
    }

    const certificateFile = req.file;
    console.log("Certificate file received:", certificateFile);

    // Upload file lên MinIO
    const certificateName = Date.now() + '_' + certificateFile.originalname;
    let fullCertificateUrl;

    try {
      const uploadResult = await minio.uploadStream(
        certificateName,
        certificateFile.buffer,
        certificateFile.size
      );
      fullCertificateUrl = `${process.env.MINIO_URL}/${uploadResult.objectName}`;
    } catch (error) {
      console.error("Error uploading certificate:", error);
      return next(new ErrorResponse(`File upload failed: ${error.message}`, 500));
    }

    // Kiểm tra xem certificate đã tồn tại chưa
    let existingCertificate = user.certificate.find(
      (cert) => cert.course.toString() === courseId
    );

    if (existingCertificate) {
      existingCertificate.certificateImg = fullCertificateUrl;
      existingCertificate.createdAt = new Date();
    } else {
      const newCertificate = {
        course: courseId,
        certificateImg: fullCertificateUrl,
        createdAt: new Date()
      };
      user.certificate.push(newCertificate);
      existingCertificate = newCertificate; // gán lại để response trả về đúng object mới
    }

    // Đánh dấu mảng certificate đã bị thay đổi để Mongoose cập nhật
    user.markModified('certificate');
    await user.save();

    console.log("Certificate saved successfully:", user.certificate);

    res.status(201).json({
      success: true,
      message: existingCertificate ? 'Certificate updated successfully' : 'Certificate created successfully',
      data: {
        certificate: existingCertificate,
        certificateImg: existingCertificate.certificateImg,
        course: {
          _id: course._id,
          title: course.title,
          instructor: course.instructor
        }
      }
    });
  } catch (error) {
    console.error('Error creating certificate:', error);
    return next(new ErrorResponse('Failed to create certificate', 500));
  }
});



