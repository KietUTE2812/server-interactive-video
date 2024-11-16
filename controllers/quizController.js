import Quiz from '../models/Quiz.js';
import asyncHandler from "express-async-handler";
import ErrorResponse from "../utils/ErrorResponse.js";
import mongoose from "mongoose";
import Progress from "../models/Progress.js";
import Course from "../models/Course.js";
import {ModuleItem} from "../models/Module.js";

// @desc    Get all quizzes
// @route   GET /api/v1/quizzes
// @access  Public
const getQuizzes = asyncHandler(async (req, res, next) => {
    const {moduleId, ...filters} = req.query;
    if (moduleId) { 
        const quizzes = await Quiz.find({moduleId}, filters);
        return res.status(200).json({ success: true, count: quizzes.length, data: quizzes });

    }
    else {
        const quizzes = await Quiz.find(filters);
        res.status(200).json({ success: true, count: quizzes.length, data: quizzes });
    }
});

// @desc    Get quiz by ID
// @route   GET /api/v1/quizzes/:id
// @access  Public
const getQuizById = asyncHandler(async (req, res, next) => {
    const quiz = await Quiz.findById(req.params.id)
        .select('-questions.answers.isCorrect') // Loại bỏ isCorrect từ câu trả lời
        .select('-questions.explanation').populate('moduleItem', 'module'); // Loại bỏ phần giải thích
    if (!quiz) {
        return next(new ErrorResponse(`Quiz not found with id of ${req.params.id}`, 404));
    }
    const progress = await Progress.findOne({
        userId: req.user._id,
        moduleId: quiz.moduleItem.module
    })
    if(progress) {
        const moduleItemProgress = progress.moduleItemProgresses.find(p => p.moduleItemId.toString() === quiz.moduleItem._id.toString());
        if(moduleItemProgress && moduleItemProgress.status === 'completed') {
            return res.status(200).json({ success: true, data: quiz, quizProgress: moduleItemProgress });
        }
    }
    res.status(200).json({ success: true, data: quiz });
});

// @desc    Create quiz
// @route   POST /api/v1/quizzes
// @access  Private
const createQuiz = asyncHandler(async (req, res, next) => {
    const {title, description, duration, passingScore, questions, moduleId} = req.body;
    
    const quiz = await Quiz.create({
        title, description, duration, passingScore, questions, moduleId
    });
    res.status(201).json({ success: true, data: quiz });
});

// @desc    Update quiz
// @route   PUT /api/v1/quizzes/:id
// @access  Private
const updateQuiz = asyncHandler(async (req, res, next) => {
    let quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
        return next(new ErrorResponse(`Quiz not found with id of ${req.params.id}`, 404));
    }

    quiz = await Quiz.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    res.status(200).json({ success: true, data: quiz });
});

// @desc    Delete quiz
// @route   DELETE /api/v1/quizzes/:id
// @access  Private
const deleteQuiz = asyncHandler(async (req, res, next) => {
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
        return next(new ErrorResponse(`Quiz not found with id of ${req.params.id}`, 404));
    }

    await quiz.remove();

    res.status(200).json({ success: true, data: {} });
});

const calculateQuizScore = (questions, answers, timeSpent) => {
    let totalQuestions = questions.length;
    let correctAnswers = 0;
    let wrongAnswers = 0;
    let totalPoints = 0;
    let earnedPoints = 0;

    const processedAnswers = questions.map((question, index) => {
        const userAnswer = answers[index];
        const correctAnswer = question.answers.find(a => a.isCorrect);

        totalPoints += question.points;
        let isCorrect = false;

        if (question.type === 'only-choice') {
            isCorrect = userAnswer === correctAnswer._id.toString();
        } else if (question.type === 'multiple-choice') {
            isCorrect = correctAnswer._id.every(id => userAnswer.includes(id.toString()));
        }

        if (isCorrect) {
            earnedPoints += question.points;
            correctAnswers++;
        } else {
            wrongAnswers++;
        }

        return {
            questionId: question._id,
            explanation: question.explanation,
            selectedAnswer: userAnswer,
            isCorrect,
            timeSpent: timeSpent / totalQuestions
        };
    });
    return { totalQuestions, correctAnswers, wrongAnswers, totalPoints, earnedPoints, processedAnswers };
};

// @desc Answer quiz and save progress
// @route POST /api/v1/quizzes/:id/answer
// @access Private
const answerQuiz = asyncHandler(async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const quiz = await Quiz.findById(req.params.id).populate('moduleItem', 'module _id').session(session);
        if (!quiz) {
            return next(new ErrorResponse(`Quiz not found with id of ${req.params.id}`, 404));
        }

        const { answers, timeSpent } = req.body;
        if (!answers || !Array.isArray(answers)) {
            return next(new ErrorResponse('Please provide an array of answers', 400));
        }

        if (answers.length !== quiz.questions.length) {
            return next(new ErrorResponse('Number of answers does not match number of questions', 400));
        }

        const { totalQuestions, correctAnswers, wrongAnswers, totalPoints, earnedPoints, processedAnswers } =
            calculateQuizScore(quiz.questions, answers, timeSpent);

        const scorePercentage = (earnedPoints / totalPoints) * 100;
        const isPassed = scorePercentage >= quiz.passingScore;

        const course = await Course.findOne({ module: { $in: [quiz.moduleItem.moduleId] } }).session(session);
        let moduleProgress = await Progress.findOne({
            userId: req.user._id,
            moduleId: quiz.moduleItem.module,
            courseId: course._id
        }).session(session);

        if (!moduleProgress) {
            moduleProgress = new Progress({
                userId: req.user._id,
                moduleId: quiz.moduleItem.module,
                courseId: course._id,
                moduleItemProgresses: []
            });
        }

        if(moduleProgress.status === 'completed') {
            return next(new ErrorResponse('Module is already completed', 400));
        }

        let moduleItemProgress = moduleProgress.moduleItemProgresses.find(
            p => p.moduleItemId.toString() === quiz.moduleItem._id.toString()
        );

        let moduleItemProgressIndex = moduleItemProgress ? moduleProgress.moduleItemProgresses.indexOf(moduleItemProgress) : -1;

        if (!moduleItemProgress) {
            moduleItemProgress = {
                moduleItemId: quiz.moduleItem._id,
                status: 'not-started',
                attempts: 0,
                timeSpent: 0
            };
            moduleProgress.moduleItemProgresses.push(moduleItemProgress);
            moduleItemProgressIndex = moduleProgress.moduleItemProgresses.length - 1;
        }

        if(moduleItemProgress.status === 'completed') {
            return next(new ErrorResponse('Quiz is already completed', 400));
        }

        moduleItemProgress.attempts += 1;
        moduleItemProgress.timeSpent += timeSpent;
        moduleItemProgress.status = isPassed ? 'completed' : 'in-progress';

        if (!moduleItemProgress.startedAt) {
            moduleItemProgress.startedAt = new Date();
        }

        if (isPassed) {
            moduleItemProgress.completedAt = new Date();
        }

        moduleItemProgress.result = {
            quiz: {
                score: scorePercentage,
                totalQuestions,
                correctAnswers,
                wrongAnswers,
                timeSpent,
                isPassed,
                answers: processedAnswers
            }
        };
        moduleProgress.moduleItemProgresses[moduleItemProgressIndex] = moduleItemProgress;
        await moduleProgress.save({ session });
        await session.commitTransaction();

        res.status(200).json({
            success: true,
            data: {
                moduleProgressId: moduleProgress._id,
                score: scorePercentage,
                totalPoints,
                earnedPoints,
                passed: isPassed,
                passingScore: quiz.passingScore,
                answers: processedAnswers,
                attempts: moduleItemProgress.attempts,
                totalTimeSpent: moduleItemProgress.timeSpent,
                status: moduleItemProgress.status,
                completionPercentage: moduleProgress.completionPercentage
            }
        });
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
});

export default { getQuizzes, getQuizById, createQuiz, updateQuiz, deleteQuiz, answerQuiz };