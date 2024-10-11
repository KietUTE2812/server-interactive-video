import express from "express";
import {
    getCourses,
    createCourse,
    getCourse,
    updateCourse,
    deleteCourse,
    approveCourse
} from "../controllers/courseController.js";

import {
    getReviews,
    getReview,
    addReview,
    updateReview,
    deleteReview
} from "../controllers/courseReviewController.js";

import {
    deleteLivestream,
    updateLivestream,
    getLivestream,
    createLivestream,
    getLivestreams
} from "../controllers/livestreamController.js";

import {
    deleteModuleItem,
    updateModuleItem,
    getModuleItem,
    createModuleItem,
    getModuleItems,
    deleteModule,
    updateModule,
    getModule,
    createModule,
    getModules
} from "../controllers/moduleController.js";

import { protect, authorize } from "../middlewares/auth.js";
const router = express.Router();

// Route cho danh sách khóa học
router.route('/')
    .get(getCourses)
    .post(protect, authorize('instructor', 'admin'), createCourse);

// Route cho khóa học cụ thể
router.route('/:courseId')
    .get(getCourse)
    .put(protect, authorize('instructor', 'admin'), updateCourse)
    .delete(protect, authorize('instructor', 'admin'), deleteCourse);

// Route cho đánh giá khóa học
router.route('/:courseId/reviews')
    .get(getReviews)
    .post(protect, authorize('student'), addReview);

router.route('/:courseId/reviews/:reviewId')
    .get(getReview)
    .put(protect, authorize('student', 'admin'), updateReview)
    .delete(protect, authorize('student', 'admin'), deleteReview);

// Route cho phê duyệt khóa học của admin
router.route('/:courseId/approve')
    .put(protect, authorize('admin'), approveCourse);

// Livestream routes
router.route('/:courseId/livestreams')
    .get(protect, getLivestreams)
    .post(protect, authorize('admin', 'instructor'), createLivestream);

router.route('/:courseId/livestreams/:id')
    .get(protect, getLivestream)
    .put(protect, authorize('admin', 'instructor'), updateLivestream)
    .delete(protect, authorize('admin', 'instructor'), deleteLivestream);

// Module routes
router.route('/:courseId/modules')
    .get(protect, getModules)
    .post(protect, authorize('admin', 'instructor'), createModule);

router.route('/:courseId/modules/:moduleId')
    .get(protect, getModule)
    .put(protect, authorize('admin', 'instructor'), updateModule)
    .delete(protect, authorize('admin', 'instructor'), deleteModule);

// ModuleItem routes
router.route('/:courseId/modules/:moduleId/lessons')
    .get(protect, getModuleItems)
    .post(protect, authorize('admin', 'instructor'), createModuleItem);

router.route('/:courseId/modules/:moduleId/lessons/:lessonId')
    .get(protect, getModuleItem)
    .put(protect, authorize('admin', 'instructor'), updateModuleItem)
    .delete(protect, authorize('admin', 'instructor'), deleteModuleItem);

export default router;