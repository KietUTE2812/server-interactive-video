import express from 'express';
import {
    searchCourseForUser,
    searchWithCategories,
    searchWithLevels,
    getCategories,
    getLevels
} from "../controllers/searchController.js";
import { protect, authorize } from "../middlewares/auth.js";

const router = express.Router();

// Route to get all categories - used for quick filtering options
router.route('/categories')
    .get(protect, authorize('student'), getCategories);

// Route to get all levels - used for quick filtering options
router.route('/levels')
    .get(protect, authorize('student'), getLevels);

// Search with categories as filter
router.route('/categories/filter')
    .get(protect, authorize('student'), searchWithCategories);

// Search with levels as filter
router.route('/levels/filter')
    .get(protect, authorize('student'), searchWithLevels);

// General search by search term with optional filters
router.route('/:searchValue')
    .get(protect, authorize('student'), searchCourseForUser);

// General search with query params
router.route('/')
    .get(protect, authorize('student'), searchCourseForUser);

export default router;