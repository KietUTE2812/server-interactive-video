import axios from 'axios';
import ProgramProblem from '../models/ProgramProblem.js';
import asyncHandler from "../middlewares/asyncHandler.js";
import ErrorResponse from "../utils/ErrorResponse.js";

// @desc      Compile code
// @route     POST /api/v1/program/compile
// @access    Public
export const compile = asyncHandler(async (req, res, next) => {
    const { code, language, input } = req.body;

    // Kiểm tra thiếu code hoặc ngôn ngữ
    if (!code || !language) {
        return next(new ErrorResponse("Missing code or language", 400));
    }

    console.log("Received request:", req.body);

    // Bản đồ ngôn ngữ và phiên bản
    const languageMap = {
        "c": { language: "c", version: "10.2.0" },
        "cpp": { language: "cpp", version: "10.2.0" },
        "python": { language: "python", version: "3.10.0" },
        "java": { language: "java", version: "15.0.2" },
        "javascript": { language: "javascript", version: "18.15.0" }
    };

    // Kiểm tra ngôn ngữ có hỗ trợ không
    if (!languageMap[language.toLowerCase()]) {
        return next(new ErrorResponse("Unsupported language", 400));
    }

    // Lấy thông tin ngôn ngữ và phiên bản từ languageMap
    const { language: lang, version } = languageMap[language.toLowerCase()];

    // Dữ liệu cần gửi đi
    const data = {
        language: lang,
        version: version,
        files: [
            {
                name: `main.${language === 'python' ? 'py' : language}`,
                content: code
            }
        ],
        stdin: input || ""
    };

    // Gọi API và trả về kết quả
    const response = await axios.post('https://emkc.org/api/v2/piston/execute', data, {
        headers: { 'Content-Type': 'application/json' }
    });

    console.log("API Response:", response.data);

    res.json({
        output: response.data.run.output,
        stderr: response.data.run.stderr,
        stdout: response.data.run.stdout,
        exitCode: response.data.run.code
    });
});

// @desc    Get all programming problems
// @route   GET /api/problems
// @access  Public
export const getProblems = asyncHandler(async (req, res, next) => {
    const problems = await ProgrammingProblem.find().select('-submissions -testcases');
    res.status(200).json({ success: true, count: problems.length, data: problems });
});

// @desc    Get single programming problem
// @route   GET /api/problems/:id
// @access  Public
export const getProblem = asyncHandler(async (req, res, next) => {
    const problem = await ProgrammingProblem.findById(req.params.id).select('-submissions -testcases');

    if (!problem) {
        return next(new ErrorResponse(`Problem not found with id of ${req.params.id}`, 404));
    }

    res.status(200).json({ success: true, data: problem });
});

// @desc    Create new programming problem
// @route   POST /api/problems
// @access  Private (Admin only)
export const createProblem = asyncHandler(async (req, res, next) => {
    // Add user to req.body
    req.body.createdBy = req.user.id;

    const problem = await ProgrammingProblem.create(req.body);

    res.status(201).json({
        success: true,
        data: problem
    });
});

// @desc    Update programming problem
// @route   PUT /api/problems/:id
// @access  Private (Admin only)
export const updateProblem = asyncHandler(async (req, res, next) => {
    let problem = await ProgrammingProblem.findById(req.params.id);

    if (!problem) {
        return next(new ErrorResponse(`Problem not found with id of ${req.params.id}`, 404));
    }

    // Make sure user is problem creator
    if (problem.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`User ${req.user.id} is not authorized to update this problem`, 401));
    }

    problem = await ProgrammingProblem.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    res.status(200).json({ success: true, data: problem });
});

// @desc    Delete programming problem
// @route   DELETE /api/problems/:id
// @access  Private (Admin only)
export const deleteProblem = asyncHandler(async (req, res, next) => {
    const problem = await ProgrammingProblem.findById(req.params.id);

    if (!problem) {
        return next(new ErrorResponse(`Problem not found with id of ${req.params.id}`, 404));
    }

    // Make sure user is problem creator
    if (problem.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`User ${req.user.id} is not authorized to delete this problem`, 401));
    }

    await problem.remove();

    res.status(200).json({ success: true, data: {} });
});

// @desc    Submit solution to programming problem
// @route   POST /api/problems/:id/submit
// @access  Private
export const submitSolution = asyncHandler(async (req, res, next) => {
    const problem = await ProgramProblem.findById(req.params.id);

    if (!problem) {
        return next(new ErrorResponse(`Problem not found with id of ${req.params.id}`, 404));
    }

    const submission = {
        userId: req.user.id,
        ...req.body
    };

    problem.submissions.push(submission);

    await problem.save();

    res.status(200).json({
        success: true,
        data: submission
    });
});

//@desc Get All Submissions
//@route GET /api/v1/problems/:id/submissions
//@access Private
export const getSubmissions = asyncHandler(async (req, res) => {
    const problem = await ProgramProblem.findById(req.params.id);

    if (!problem) {
        return next(new ErrorResponse(`Problem not found with id of ${req.params.id}`, 404));
    }

    res.status(200).json({ success: true, count: problem.submissions.length, data: problem.submissions });
});

// @desc    Get single submission
// @route   GET /api/problems/:id/submissions/:submissionId
// @access  Private
export const getSubmission = asyncHandler(async (req, res, next) => {
    const problem = await ProgramProblem.findById(req.params.id);

    if (!problem) {
        return next(new ErrorResponse(`Problem not found with id of ${req.params.id}`, 404));
    }

    const submission = problem.submissions.find(sub => sub._id.toString() === req.params.submissionId);

    if (!submission) {
        return next(new ErrorResponse(`Submission not found with id of ${req.params.submissionId}`, 404));
    }

    res.status(200).json({ success: true, data: submission });
});



