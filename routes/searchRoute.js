import express from 'express';
import {
    searchCourseForUser,
    searchWithTags,
    searchWithLevels,
    getTags,
    getLevels,
    fetchCourses,
    // createSearchIndex,
    // advancedSearch
} from "../controllers/searchController.js";
import { protect, authorize } from "../middlewares/auth.js";

const router = express.Router();

// Route to get all Tags - used for quick filtering options
router.route('/tags')
    .get(protect, authorize('student'), getTags);

// Route to get all levels - used for quick filtering options
router.route('/levels')
    .get(protect, authorize('student'), getLevels);

// Search with Tags as filter
router.route('/tags/filter')
    .get(protect, authorize('student'), searchWithTags);

// Search with levels as filter
router.route('/levels/filter')
    .get(protect, authorize('student'), searchWithLevels);

// General search by search term with optional filters
// router.route('/:searchValue')
//     .get(protect, authorize('student'), searchCourseForUser);

// General search with query params
router.route('/')
    .get(protect, authorize('student'), searchCourseForUser);


router.route('/fetchCourses')
    .get(protect, authorize('student'), fetchCourses);

// // Route cho tạo text index - dành riêng cho admin
// router.route('/create-index')
//     .post(protect, authorize('admin'), createSearchIndex);

// // Route cho tìm kiếm nâng cao với nhiều tiêu chí
// router.route('/advanced')
//     .post(protect, authorize('student'), advancedSearch);

export default router;