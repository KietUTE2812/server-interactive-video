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

// import {
//     getReviews,
//     getReview,
//     addReview,
//     updateReview,
//     deleteReview
// } from "../controllers/courseReviewController.js";

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

    getModuleById

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
import { isLoggedin } from "../middlewares/isLoggedin.js";


const router = express.Router();

// Route cho danh sách khóa học
router.route('/')
    .get(getCourses)
    .post(protect, authorize('instructor', 'admin'), createCourse); //protect, authorize('instructor', 'admin'),
router.route('/getCourseByInstructor').get(protect, authorize('instructor', 'admin'), getCourseByInstructor);
// Route cho khóa học cụ thể
router.route('/:id')
    .get(isLoggedin ,getCourseById)
    .put(protect, authorize('instructor', 'admin'), updateCourse) //protect, authorize('instructor', 'admin'),

router.route('/enroll/:courseId').post(protect, authorize('student'), enrollCourse); // protect, authorize('student'),



//.delete(protect, authorize('instructor', 'admin'), deleteCourse); // protect, authorize('instructor', 'admin'),

// // Route cho đánh giá khóa học
// router.route('/:id/reviews')
//     .get(getReviews)
//     .post(protect, authorize('student'), addReview); // protect, authorize('student'),
//
// router.route('/:id/reviews/:reviewId')
//     //.get(getReview)
//     //.put(protect, authorize('student', 'admin'), updateReview) // protect, authorize('student', 'admin'),
//     .delete(protect, authorize('admin'), deleteReview); // protect, authorize('student', 'admin'),

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

    .get(protect)

router.route('/:id/modules/:moduleId/quiz')
    .get(protect)
    .post(protect, authorize('admin', 'instructor'), createModuleItemQuiz);

router.route('/:id/modules/:moduleId/supplement')
    .post(
        protect,
        authorize('admin', 'instructor'),
        upload.single('file'),
        createModuleItemSupplement);

router.route('/:id/modules/:moduleId/lecture')
    .get(protect)
    .post(protect,
        authorize('admin', 'instructor'),
        upload.single('file'),
        createModuleItemLecture);

router.route('/:id/modules/:moduleId/programming')
    .get(protect)
    .post(protect, authorize('admin', 'instructor'), createModuleItemProgramming);

// get the module items for a module
router.route('/moduleitem/:moduleItemId')
    .get(protect, authorize('admin', 'instructor', 'student'), getModuleItemById);


// router.route('/:id/modules/:moduleId/lessons/:lessonId')
//     .get(protect, getModuleItem)



export default router;