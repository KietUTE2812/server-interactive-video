import axios from 'axios';
import ProgramProblem from '../models/ProgramProblem.js';
import asyncHandler from "../middlewares/asyncHandler.js";
import ErrorResponse from "../utils/ErrorResponse.js";
import convertCode from './convertCode.js';
import generate from '../utils/generateByOpenAI.js';
import Submission from '../models/Submission.js';
import mongoose from 'mongoose';
import ModuleProgress from '../models/Progress.js';

// @desc      Compile code
// @route     POST /api/v1/program/compile
// @access    Public
export const compile = asyncHandler(async (req, res, next) => {
    const { code, language, input, codeExecute } = req.body;

    // Kiểm tra thiếu code hoặc ngôn ngữ
    if (!code || !language) {
        return next(new ErrorResponse("Missing code or language", 400));
    }

    const codeDe = convertCode(code, input, language, codeExecute);
    console.log("Converted Code:", codeDe);

    // console.log("Combined Code:", codeDe, code);
    //console.log("Received request:", req.body);

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
                content: codeDe
            }
        ],
        stdin: ""
    };
    console.log("Data to send:", data);

    // Gọi API và trả về kết quả
    const response = await axios.post('https://emkc.org/api/v2/piston/execute', data, {
        headers: { 'Content-Type': 'application/json' }
    });

    console.log("API Response:", response.data);
    res.status(200).json({
        success: true,
        data: {
            output: response.data.run.output,
            stderr: response.data.run.stderr,
            stdout: response.data.run.stdout,
            exitCode: response.data.run.code
        }
    });
    // res.json({
    //     output: response.data.run.output,
    //     stderr: response.data.run.stderr,
    //     stdout: response.data.run.stdout,
    //     exitCode: response.data.run.code
    // });
});

// @desc    Get all programming problems
// @route   GET /api/problems
// @access  Public
export const getProblems = asyncHandler(async (req, res, next) => {
    const problems = await ProgramProblem.find().select('-submissions -testcases');
    res.status(200).json({ success: true, count: problems.length, data: problems });
});

// @desc    Get single programming problem
// @route   GET /api/problems/:id
// @access  Public
export const getProblem = asyncHandler(async (req, res, next) => {
    const problem = await ProgramProblem.findById(req.params.id)
        .populate('testcases');

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

    const problem = await ProgramProblem.create(req.body);

    res.status(201).json({
        success: true,
        data: problem
    });
});

// @desc    Update programming problem
// @route   PUT /api/problems/:id
// @access  Private (Admin only)
export const updateProblem = asyncHandler(async (req, res, next) => {
    let problem = await ProgramProblem.findById(req.params.id);

    if (!problem) {
        return next(new ErrorResponse(`Problem not found with id of ${req.params.id}`, 404));
    }

    // Make sure user is problem creator
    if (problem.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`User ${req.user.id} is not authorized to update this problem`, 401));
    }

    problem = await ProgramProblem.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    res.status(200).json({ success: true, data: problem });
});

// @desc    Delete programming problem
// @route   DELETE /api/problems/:id
// @access  Private (Admin only)
export const deleteProblem = asyncHandler(async (req, res, next) => {
    const problem = await ProgramProblem.findById(req.params.id);

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

export const submissionCode = asyncHandler(async (req, res, next) => {
    const { code, language, testcases, codeExecute, progressData } = req.body;
    if (!code || !language || !testcases.length) {
        return next(new ErrorResponse("Missing data", 400));
    }
    console.log('Received request body:', {
        code: code ? 'Code received' : 'No code',
        language,
        testcases: testcases ? testcases.length : 'No testcases',
        codeExecute,
        progressData: JSON.stringify(progressData), // Log toàn bộ progressData
    });
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
    if (!progressData) {
        return next(new ErrorResponse("Progress data not found", 400));
    }

    // Lấy thông tin ngôn ngữ và phiên bản từ languageMap
    const { language: lang, version } = languageMap[language.toLowerCase()];

    const results = [];
    const testcaseResults = [];
    let fileSize = null;
    const testcaseStatuses = [];

    // Hàm xác định status tổng thể cho submission
    const determineOverallSubmissionStatus = (results, apiErrors) => {
        const passedTestcases = results.filter(result => result.passed).length;
        const totalTestcases = results.length;

        // Kiểm tra lỗi từ API trước
        if (apiErrors.compilationError) {
            return 'Compilation Error';
        }

        if (apiErrors.runtimeError) {
            return 'Runtime Error';
        }

        // Kiểm tra kết quả test case
        if (passedTestcases === totalTestcases) {
            return 'Accepted';
        } else if (passedTestcases > 0) {
            return 'Partially Accepted';
        } else {
            return 'Wrong Answer';
        }
    };

    // Theo dõi các lỗi từ API
    const apiErrors = {
        compilationError: false,
        runtimeError: false
    };

    // console.log("Received request:", req.body);
    // console.log("code:", code);

    for (const testcase of testcases) {
        // console.log("input:", testcase.input);
        // Thêm input của testcase vào stdin
        const codeDe = convertCode(code, testcase.input, language, codeExecute);
        fileSize = getFileSize(codeDe);
        const data = {
            language: lang,
            version: version,
            files: [
                {
                    name: `main.${language === 'python' ? 'py' : language}`,
                    content: codeDe
                }
            ],
            stdin: ""
        };
        try {
            // Gọi API thực thi code
            const response = await axios.post('https://emkc.org/api/v2/piston/execute', data, {
                headers: { 'Content-Type': 'application/json' }
            });
            //console.log("API Response:", response.data);

            // Kiểm tra kết quả thực thi
            const executionResult = response.data.run.output.trim();
            const isPassed = executionResult === testcase.expectedOutput;

            if (response.data.run.stderr && !response.data.run.output) {
                apiErrors.compilationError = true;
            }

            testcaseResults.push({
                input: testcase.input,
                expectedOutput: testcase.expectedOutput,
                actualOutput: executionResult,
                passed: isPassed,
                executeTime: response.data.run.real_time || 0,
                executeTimeLimit: testcase.executeTimeLimit
            });

            results.push({
                testcaseId: testcase._id,
                input: testcase.input,
                expectedOutput: testcase.expectedOutput,
                actualOutput: executionResult,
                passed: isPassed,
                executeTime: response.data.run.real_time || 0
            });

        } catch (error) {
            apiErrors.runtimeError = true;

            results.push({
                testcaseId: testcase._id,
                input: testcase.input,
                error: error.message,
                passed: false
            });
        }
    }


    // Tính toán tỷ lệ testcase pass
    const passedTestcases = results.filter(result => result.passed).length;
    const totalTestcases = results.length;
    const passRate = (passedTestcases / totalTestcases) * 100;


    const overallSubmissionStatus = determineOverallSubmissionStatus(results, apiErrors);

    const submission = {
        problemId: req.params.id,
        userId: req.user.id,
        status: overallSubmissionStatus,
        language: language,
        src: code,
        score: passRate,
        runtime: '',
        memory: fileSize
    };

    //console.log("submission: ", submission);
    try {
        const newSubmission = await Submission.create(submission);

        //console.log("progressData: ", progressData);

        const moduleProgress = await ModuleProgress.findOne({
            'moduleItemProgresses._id': progressData?._id
        });

        if (!moduleProgress) {
            return (next(ErrorResponse('ModuleProgress not found', 404)));
        }

        // Tìm và cập nhật moduleItemProgress cụ thể
        const moduleItemProgressIndex = moduleProgress.moduleItemProgresses.findIndex(
            item => item._id.toString() === progressData._id.toString()
        );

        if (moduleItemProgressIndex === -1) {
            return (next(ErrorResponse('ModuleItemProgress not found', 404)));
        }

        const updatedModuleItemProgress = {
            ...progressData,
            attempts: (progressData.attempts || 0) + 1,
            status: passRate === 100 ? 'completed' : 'in-progress',
            completedAt: passRate === 100 ? new Date() : null,
            result: {
                ...progressData.result,
                programming: {
                    submissionId: newSubmission._id,
                    testCasesPassed: passedTestcases,
                    totalTestCases: totalTestcases,
                    score: passRate,
                    code: code,
                    language: language,
                    executionTime: '', // Nếu có
                    memory: fileSize
                }
            }
        };
        // Thay thế moduleItemProgress cũ
        moduleProgress.moduleItemProgresses[moduleItemProgressIndex] = updatedModuleItemProgress;

        // Lưu lại ModuleProgress (middleware sẽ tự động tính toán các giá trị như completionPercentage)
        await moduleProgress.save();

        res.status(200).json({
            data: {
                results: results,
                passRate: passRate,
                allPassed: passedTestcases === totalTestcases
            },
            testcases: testcaseResults,
            submission: newSubmission,
            moduleItemProgress: updatedModuleItemProgress
        });
    }
    catch (e) {
        return next(new ErrorResponse(e.message, 400));
    }


});

//@desc Get All Submissions
//@route GET /api/v1/problems/:id/submissions
//@access Private
export const getSubmissions = asyncHandler(async (req, res, next) => {
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
    const { id } = req.params;
    const userId = req.user.id;

    // Kiểm tra tính hợp lệ của problemId và userId
    if (!mongoose.Types.ObjectId.isValid(id) ||
        !mongoose.Types.ObjectId.isValid(userId)) {
        return next(new ErrorResponse('Invalid Problem or User ID', 400));
    }
    const problem = await ProgramProblem.findById(id);
    if (!problem) {
        return next(new ErrorResponse('Problem not found', 404));
    }

    // Tìm kiếm tất cả submissions cho problem và user cụ thể
    const submissions = await Submission.find({
        problemId: id,
        userId: userId
    })
        .sort({ createdAt: -1 }) // Sắp xếp từ mới nhất đến cũ nhất
        .populate({
            path: 'problemId',
            select: 'title difficulty' // Chọn các trường cần thiết của problem
        });

    // Nếu không tìm thấy submissions
    if (!submissions || submissions.length === 0) {
        return next(new ErrorResponse('No submissions found', 404));
    }


    // Thống kê submission
    const submissionStats = {
        total: submissions.length,
        acceptedCount: submissions.filter(sub => sub.status === 'Accepted').length,
        bestScore: Math.max(...submissions.map(sub => sub.score)),
        statuses: submissions.reduce((acc, sub) => {
            acc[sub.status] = (acc[sub.status] || 0) + 1;
            return acc;
        }, {})
    };

    res.status(200).json({
        success: true,
        data: {
            submissions,
            stats: submissionStats
        }
    });
});

export const generateChartCode = asyncHandler(async (req, res, next) => {
    const { code, language } = req.body;
    if (!code || !language) {
        return next(new ErrorResponse("Missing code or language", 400));
    }
    const prompt = `Generate a chart from the given code, using ${language} language
    Required:
    - Input: 
        ${code}
      - Output: There is only one code for MERMAID to visualize how the code runs. Important, A content of a node in chart must be wrap by the parentheses "". If the code does not contain data that can be visualized, return a message saying "No data to visualize".
      - Example: 
        graph TD;
        A["Start"] --> B["Initialize left = 0, right = len(nums) - 1"];
        B --> C{"left <= right?"};
        C -- No --> D["Return left"];
    `;
    const response = await generate.generateChartCode(prompt);
    if (!response || !response.data ) {

        return next(new ErrorResponse('Failed to generate chart code', 500));
    }
    res.status(200).json({ success: true, data: response.data});

})


// export const getProblemById = asyncHandler(async (req, res, next) => {
//     const problemId = req.params.id;
//     const problem = await ProgramProblem.findById(problemId);
//     if (!problem) {
//         return next(new ErrorResponse(`Problem not found with id of ${problemId}`, 404));
//     }
//     res.status(200).json({ success: true, data: problem });
// })

function getFileSize(content) {
    const blob = new Blob([content], { text: 'text/plain' }).size;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (blob === 0) return 'n/a';
    const i = parseInt(Math.floor(Math.log(blob) / Math.log(1024)), 10);
    return Math.round(blob / Math.pow(1024, i), 2) + ' ' + sizes[i];
}



