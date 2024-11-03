import express from "express";
import {
    getCourses,
    createCourse,
    getCourseById,
    updateCourse,
    approveCourse,
    getCourseByCourseId,
    getCourseByInstructor
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
    getModulesByCourseId,
    createModule,

} from "../controllers/moduleController.js";

import { protect, authorize } from "../middlewares/auth.js";
const router = express.Router();

// Route cho danh sách khóa học
router.route('/')
    .get(getCourses)
    .post(protect, authorize('instructor', 'admin'), createCourse); //protect, authorize('instructor', 'admin'),
router.route('/getCourseByInstructor').get(protect, authorize('instructor', 'admin'), getCourseByInstructor);
// Route cho khóa học cụ thể
router.route('/:id')
    .get(getCourseByCourseId)
    .put(protect, authorize('instructor', 'admin'), updateCourse) //protect, authorize('instructor', 'admin'),

//.delete(protect, authorize('instructor', 'admin'), deleteCourse); // protect, authorize('instructor', 'admin'),

// Route cho đánh giá khóa học
router.route('/:id/reviews')
    .get(getReviews)
    .post(protect, authorize('student'), addReview); // protect, authorize('student'),

router.route('/:id/reviews/:reviewId')
    //.get(getReview)
    //.put(protect, authorize('student', 'admin'), updateReview) // protect, authorize('student', 'admin'),
    .delete(protect, authorize('admin'), deleteReview); // protect, authorize('student', 'admin'),

// Route cho phê duyệt khóa học của admin
router.route('/:id/approve')
    .put(protect, authorize('admin'), approveCourse); // protect, authorize('admin'),

// Livestream routes
router.route('/:id/livestreams')
    .get(protect, getLivestreams)
    .post(protect, authorize('admin', 'instructor'), createLivestream); //protect, authorize('admin', 'instructor'),



router.route('/:id/livestreams/:liveId')
    .get(protect, getLivestream)
    .put(protect, authorize('admin', 'instructor'), updateLivestream)
    .delete(protect, authorize('admin', 'instructor'), deleteLivestream);

// Module routes
router.route('/:id/modules')
    .get(protect, getModulesByCourseId)
    .post(protect, authorize('admin', 'instructor'), createModule);

router.route('/:id/modules/:moduleId')
    // .get(protect, getModule)
    .put(protect, authorize('admin', 'instructor'), updateModule)
    .delete(protect, authorize('admin', 'instructor'), deleteModule);

// ModuleItem routes
router.route('/:id/modules/:moduleId/lessons')
    .get(protect, getModuleItems)
    .post(protect, authorize('admin', 'instructor'), createModuleItem);

router.route('/:id/modules/:moduleId/lessons/:lessonId')
    .get(protect, getModuleItem)
    .put(protect, authorize('admin', 'instructor'), updateModuleItem)
    .delete(protect, authorize('admin', 'instructor'), deleteModuleItem);

export default router;