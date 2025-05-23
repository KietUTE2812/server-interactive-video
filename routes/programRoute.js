import express from "express";
import {
    getSubmission,
    getSubmissions,
    submitSolution,
    getProblems,
    getProblem,
    createProblem,
    updateProblem,
    deleteProblem,
    compile,
    submissionCode,
    generateChartCode,

    codeCompletion
} from "../controllers/programController.js";
import { protect, authorize } from "../middlewares/auth.js";
const router = express.Router();

router.post('/compile', compile);

// Problem routes
router.route('/')
    .get(getProblems)
    .post(protect, authorize('admin', 'instructor'), createProblem);

router.route('/runcode/:id')
    .post(protect, authorize('admin', 'instructor', 'student'), compile)

router.route('/submitcode/:id')
    .post(protect, authorize('admin', 'instructor', 'student'), submissionCode)
    .get(protect, authorize('admin', 'instructor', 'student'), getSubmission)

router.route('/:id')
    .get(getProblem)
    .put(protect, authorize('admin', 'instructor'), updateProblem)
    .delete(protect, authorize('admin', 'instructor'), deleteProblem);

//Submit routes
router.route('/:id/submit')
    .get(protect, getSubmissions)
    .post(protect, submitSolution);
router.route('/:id/submit/:submissionId')
    .get(protect, getSubmission);

router.route('/generate-chart').post(generateChartCode);

router.route('/code-completion')
    .post(codeCompletion)

export default router;