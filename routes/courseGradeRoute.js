import express from "express";
import {
    getCourseGrade,
    updateCourseGrade,
    createAssignment,
    getAssignment,
    updateAssignment,
    deleteAssignment,
} from "../controllers/courseGradeController.js";
import { protect, authorize } from "../middlewares/auth.js";

const router = express.Router();

// Course Grade routes
router.route('/:courseId')
    .get(protect, getCourseGrade);

router.route('/')
    .post(protect, updateCourseGrade);

// Assignment routes
router.route('/:courseId/assignments')
    .post(protect, createAssignment);

router.route('/:courseId/assignments/:id')
    .get(protect, getAssignment)
    .put(protect, updateAssignment)
    .delete(protect, authorize('admin', 'instructor'), deleteAssignment);

export default router;
