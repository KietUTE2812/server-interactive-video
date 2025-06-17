import express from "express";
import Course from "../models/Course.js";
import {
    getCourses,
    createCourse,
    getCourseById,
    updateCourse,
    approveCourse,
    getCourseByCourseId,
    getCourseByInstructor,
    getAllCoursebyUser,
    deleteCourse,
    getCourseStats,
    getCertificate,
    createCertificate
} from "../controllers/courseController.js";

import {
    deleteLivestream,
    updateLivestream,
    getLivestream,
    createLivestream,
    getLivestreams
} from "../controllers/livestreamController.js";

import {
    deleteModule,
    updateModule,
    getModulesByCourseId,
    createModule,
    getModuleById,
    getAllModuleByModuleItemId,
    getModuleByModuleItemId
} from "../controllers/moduleController.js";

import {
    createModuleItemQuiz,
    createModuleItemSupplement,
    createModuleItemLecture,
    createModuleItemProgramming,
    getModuleItemById,
} from "../controllers/moduleItemController.js";

import { enrollCourse } from "../controllers/userActionController.js";
import { protect, authorize } from "../middlewares/auth.js";
import upload from "../middlewares/upload.js";
import { recommendContentBased, recommendCollaborative, recommendHybrid, recommendPopular } from "../controllers/recommendSystem.js";

const router = express.Router();

// Middleware để kiểm tra quyền truy cập khóa học
// Cho phép admin hoặc instructor sở hữu khóa học truy cập
const authorizeCourseAccess = async (req, res, next) => {
    try {
        const courseId = req.params.id;
        const userId = req.user._id.toString();

        // Admin luôn có quyền truy cập
        if (req.user.role === 'admin') {
            return next();
        }

        // Tìm khóa học để kiểm tra instructor
        const course = await Course.findById(courseId);

        if (!course) {
            return res.status(404).json({
                status: "error",
                message: "Course not found"
            });
        }

        // Kiểm tra xem người dùng có phải là instructor của khóa học không
        if (req.user.role === 'instructor' && course.instructor.toString() === userId) {
            return next();
        }

        return res.status(403).json({
            status: "error",
            message: "You are not authorized to access this course"
        });
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Server error",
            error: error.message
        });
    }
};

// ===== PUBLIC OR AUTHENTICATED ROUTES =====
// Lấy danh sách khóa học (ngườhập sẽ thi dùng đã đăng nấy các khóa học phù hợp với role)
router.route('/')
    .get(protect, getCourses);

router.route('/courseId/:id')
    .get(getCourseByCourseId);

router.route('/recommend')
    .get(protect, recommendContentBased);
router.route('/recommend/collaborative')
    .get(protect, recommendCollaborative);
router.route('/recommend/hybrid')
    .get(protect, recommendHybrid);
router.route('/recommend/popular')
    .get(protect, recommendPopular);

// ===== STUDENT ROUTES =====
// Đăng ký khóa học - chỉ dành cho học viên
router.route('/enroll/:courseId')
    .post(protect, authorize('student'), enrollCourse);

// Lấy danh sách khóa học đã đăng ký - dành cho học viên hoặc admin
router.route('/my-learning')
    .get(protect, authorize('admin', 'student'), getAllCoursebyUser);

// ===== INSTRUCTOR ROUTES =====
// Lấy danh sách khóa học của giảng viên
router.route('/instructor')
    .get(protect, authorize('instructor', 'admin'), getCourseByInstructor);

// ===== COURSE MANAGEMENT ROUTES (INSTRUCTOR & ADMIN) =====
// Tạo khóa học mới - dành cho giảng viên và admin
router.route('/')
    .post(
        protect,
        authorize('instructor', 'admin'),
        upload.fields([
            { name: 'photo', maxCount: 1 }, // Tải lên ảnh đại diện khóa học
            { name: 'sumaryVideo', maxCount: 1 } // Tải lên video tóm tắt khóa học 
        ]),
        createCourse
    );

// Quản lý một khóa học cụ thể
router.route('/:id')
    .get(protect, getCourseById) // Xem thông tin khóa học - tất cả role đã đăng nhập
    .put(
        protect,
        authorizeCourseAccess, // Chỉ admin hoặc instructor sở hữu khóa học
        upload.fields([
            { name: 'photo', maxCount: 1 }, // Tải lên ảnh đại diện khóa học
            { name: 'sumaryVideo', maxCount: 1 } // Tải lên video tóm tắt khóa học 
        ]),
        updateCourse
    )
    .delete(
        protect,
        authorizeCourseAccess, // Chỉ admin hoặc instructor sở hữu khóa học
        deleteCourse
    );

// ===== ADMIN ROUTES =====
// Phê duyệt khóa học - chỉ dành cho admin
router.route('/:id/approve')
    .put(protect, authorize('admin'), approveCourse);

router.route('/admin/stats')
    .get(protect, authorize('admin'), getCourseStats);

// ===== MODULE ROUTES =====
router.route('/:id/modules')
    .get(protect, getModulesByCourseId) // Xem danh sách module - tất cả role đã đăng nhập
    .post(
        protect,
        authorizeCourseAccess, // Chỉ admin hoặc instructor sở hữu khóa học
        createModule
    );

router.route('/:id/modules/:moduleId')
    .get(protect, getModuleById) // Xem chi tiết module - tất cả role đã đăng nhập
    .put(
        protect,
        authorizeCourseAccess, // Chỉ admin hoặc instructor sở hữu khóa học
        updateModule
    )
    .delete(
        protect,
        authorizeCourseAccess, // Chỉ admin hoặc instructor sở hữu khóa học
        deleteModule
    );

router.route('/modules/:id')
    .get(protect, getModuleById); // Xem chi tiết module - tất cả role đã đăng nhập

// ===== MODULE ITEM ROUTES =====
// Quiz
router.route('/:id/modules/:moduleId/quiz')
    .post(
        protect,
        authorizeCourseAccess, // Chỉ admin hoặc instructor sở hữu khóa học
        createModuleItemQuiz
    );

// Supplement
router.route('/:id/modules/:moduleId/supplement')
    .post(
        protect,
        authorizeCourseAccess, // Chỉ admin hoặc instructor sở hữu khóa học
        upload.single('file'),
        createModuleItemSupplement
    );

// Lecture
router.route('/:id/modules/:moduleId/lecture')
    .post(
        protect,
        authorizeCourseAccess, // Chỉ admin hoặc instructor sở hữu khóa học
        upload.single('file'),
        createModuleItemLecture
    );

// Programming
router.route('/:id/modules/:moduleId/programming')
    .post(
        protect,
        authorizeCourseAccess, // Chỉ admin hoặc instructor sở hữu khóa học
        createModuleItemProgramming
    );

// ===== MODULE ITEM ACCESS ROUTES =====
router.route('/moduleitem/getAllModule/:itemId')
    .get(protect, getAllModuleByModuleItemId); // Tất cả role đã đăng nhập

router.route('/moduleitem/getModule/:itemId')
    .get(protect, getModuleByModuleItemId); // Tất cả role đã đăng nhập

router.route('/moduleitem/:moduleItemId')
    .get(protect, getModuleItemById); // Tất cả role đã đăng nhập

router.route('/certificate/:id')
    .get(protect, authorize('student'), getCertificate)
    .post(protect, authorize('student'), upload.single('certificate'), createCertificate);

export default router;