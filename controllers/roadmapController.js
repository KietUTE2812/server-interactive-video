import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import ErrorResponse from "../utils/ErrorResponse.js";
import generate from "../utils/generateByOpenAI.js";
import roadmap from "../models/Roadmap.js";
import { select, timeout } from "async";

const Roadmap = roadmap.Roadmap;
const RoadmapItemTest = roadmap.RoadmapItemTest;
const UserTestResult = roadmap.UserTestResult;

const createRoadmap = asyncHandler(async (req, res, next) => {
    const { formData } = req.body;
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
        return next(new ErrorResponse(`User not found with id of ${userId}`, 404));
    }
    if (!formData.learningGoal || !formData.timeCommitment) {
        return next(new ErrorResponse('Please provide all required fields', 400));
    }
    const prompt = `
        I have a user with the following information:
        - Experience level: ${formData.experienceLevel}
        - Current skills: ${formData.currentSkills}
        - Learning goal: ${formData.learningGoal.description} (${formData.learningGoal.label})
        - Preferred language: ${formData.preferredLanguages.join(', ') || 'None'}
        - Time commitment: ${formData.timeCommitment} hours per week
        - Goal timeframe: ${formData.goalTimeframe} months
        - Additional notes: ${formData.additionalInfo}
        Create a JSON String for the roadmap for this user to achieve their learning goals. Break it down into phases and suggest specific skills and technologies they should learn in each phase, with an estimated time for each phase. If possible, recommend projects they can work on to apply their knowledge.
        Only return the JSON string.
        Roadmap model:
        // Schema for individual items in a phase
        const RoadmapItemSchema = new Schema({
            name: {
                type: String,
                required: true,
                trim: true
            },
            tags: [String],
            description: {
                type: String,
                required: true,
                trim: true
            },
            completed: {
                type: Boolean,
                default: false
            },
            order: {
                type: Number,
                required: true
            }
        }, { _id: true });
        
        // Schema for phases
        const PhaseSchema = new Schema({
            phase: {
                type: Number,
                required: true,
                min: 1
            },
            name: {
                type: String,
                required: true,
                trim: true
            },
            duration: {
                type: Number,
                required: true,
                min: 0
            },
            items: [RoadmapItemSchema],
            status: {
                type: String,
                enum: ['not-started', 'in-progress', 'completed'],
                default: 'not-started'
            },
            startDate: {
                type: Date
            },
            endDate: {
                type: Date
            }
        }, { _id: true });
        
        // Main Roadmap Schema
        const RoadmapSchema = new Schema({
            title: {
                type: String,
                required: true,
                trim: true
            },
            description: {
                type: String,
                trim: true
            },
            phases: [PhaseSchema],
            creator: {
                type: Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            visibility: {
                type: String,
                enum: ['private', 'public', 'shared'],
                default: 'private'
            },
            tags: [{
                type: String,
                trim: true
            }],
            difficulty: {
                type: String,
                enum: ['beginner', 'intermediate', 'advanced'],
                default: 'beginner'
            },
            estimatedTimeInMonths: {
                type: Number,
                min: 0
            },
            category: {
                type: String,
                required: true,
                trim: true
            }
        }, {
            timestamps: true,
            toJSON: { virtuals: true },
            toObject: { virtuals: true }
        });
        `;
    const response = await generate.generateRoadmap(prompt);
    console.log(response);
    if (!response || !response.data.title) {
        return next(new ErrorResponse('Failed to generate roadmap', 500));
    }
    const data = response.data
    const roadmap = await Roadmap.create({
        title: data.title,
        description: data.description,
        phases: data.phases,
        creator: userId,
        visibility: 'private',
        category: data.category,
        tags: data.tags,
        difficulty: data.difficulty,
        estimatedTimeInMonths: data.estimatedTimeInMonths
    });

    if (!roadmap) {
        return next(new ErrorResponse('Failed to create roadmap', 500));
    }
    res.json({ success: true, data: roadmap });
});

const createTest = asyncHandler(async (req, res, next) => {
    const { roadmapId, phaseId, itemId } = req.body;
    const roadmap = await Roadmap.findById(roadmapId);
    if (!roadmap) {
        return next(new ErrorResponse(`Roadmap not found with id of ${roadmapId}`, 404));
    }
    const phase = roadmap.phases.id(phaseId);
    if (!phase) {
        return next(new ErrorResponse(`Phase not found with id of ${phaseId}`, 404));
    }
    const item = phase.items.id(itemId);
    if (!item) {
        return next(new ErrorResponse(`Item not found with id of ${itemId}`, 404));
    }
    const testId = item?.test;
    if (testId) {
        const testExists = await RoadmapItemTest.findById(testId);
        const isPassed = await UserTestResult.findOne({ userId: req.user._id, testId: testId, passed: true });        
        res.json({ success: true, data: {
            ...testExists._doc,
            passed: isPassed ? true : false
        } });
        return;
    }
    // Prompt for generating test for the item
    const prompt = `
        I have a user with the following roadmap information:
        - Roadmap title: ${roadmap.title}
        - Roadmap description: ${roadmap.description}
        - Roadmap category: ${roadmap.category}
        - Roadmap difficulty: ${roadmap.difficulty}
        - Phase: ${phase.name}
        - Item: ${item.name}
        - Item description: ${item.description}
        - Item order: ${item.order}
        - Item tags: ${item.tags.join(', ') || 'None'}
        Create a test which has at least 10 questions for this item. Only return the JSON string.
        Following is the schema for the test:
        // Schema for test questions
        const TestQuestionSchema = new Schema({
            question: {
                type: String,
                required: true,
                trim: true
            },
            options: {
                type: [{
                    _id: false,
                    text: {
                        type: String,
                        required: true,
                        trim: true
                    },
                    isCorrect: {
                        type: Boolean,
                        default: false
                    }
                }],
            },
            type: {
                type: String,
                enum: ['single-choice','multiple-choice'], // True/false will be treated as single-choice 
                default: 'multiple-choice'
            },
            explanation: {
                type: String,
                trim: true,
                default: ''
            },
            points: {
                type: Number,
                default: 1,
                min: 0
            }
        }, { _id: true });

        const RoadmapItemTestSchema = new Schema({
            itemId: {
                type: String,
                required: true
            },
            title: {
                type: String,
                required: true,
                trim: true
            },
            description: {
                type: String,
                trim: true
            },
            questions: [TestQuestionSchema],
            passingScore: {
                type: Number,
                required: true,
                min: 0
            },
            timeLimit: {
                type: Number, // Time limit in minutes
                min: 0
            },
            status: {
                type: String,
                enum: ['active', 'draft'],
                default: 'active'
            }
        }, {
            timestamps: true
        });
        `;
    const response = await generate.generateRoadmap(prompt);
    const data = response?.data;
    if(!data) {
        return next(new ErrorResponse('Failed to generate test', 500));
    }
    try {
        const test = await RoadmapItemTest.create({ 
            itemId: itemId,
            title: data.title,
            description: data.description,
            questions: data.questions,
            passingScore: data.passingScore,
            timeLimit: data.timeLimit,
        });
        item.test = test._id;
        await roadmap.save();
        res.json({ success: true, data: test });

    }
    catch (error) {
        console.error(error);
        return next(new ErrorResponse('Failed to create test', 500));
    }
});

const getRoadmaps = asyncHandler(async (req, res, next) => {
    const filter = req.query;
    let roadmaps = null
    if (filter.userId)
        roadmaps = await Roadmap.find({ creator: filter.userId });
    else if (filter != {})
        roadmaps = await Roadmap.find(filter);
    if (!roadmaps) {
        return next(new ErrorResponse(`Roadmap not found`, 404));
    }
    // Delete the test data
    // Xóa dữ liệu test để tránh lộ đáp án
    roadmaps = roadmaps.map(roadmap => {
        const cleanRoadmap = JSON.parse(JSON.stringify(roadmap)); // Clone object để tránh ảnh hưởng DB
        cleanRoadmap.phases.forEach(phase => {
            phase.items.forEach(item => {
                if (item.test && item.test.questions) {
                    item.test.questions.forEach(question => {
                        delete question.explanation;
                        question.options.forEach(option => {
                            delete option.isCorrect;
                        });
                    });
                }
            });
        });
        return cleanRoadmap;
    })
    res.json({ success: true, data: roadmaps });
})

const submitTest = asyncHandler(async (req, res, next) => {
    const { testId, answers, timeTaken } = req.body; // answer = { questionId: optionIndex} Object
    const test = await RoadmapItemTest.findById(testId);
    if (!test) {
        return next(new ErrorResponse(`Test not found with id of ${testId}`, 404));
    }
    const userId = req.user._id;
    const questions = test.questions;
    let earnPoints = 0
    // Calculate the score
    questions.forEach(question => {
        const optionIndex = answers[question._id];
        if (optionIndex === null) {
            return;
        }
        const correctIndex = [] // Index of correct options for multiple-choice question
        question.options.forEach((option, index) => {
            if (option.isCorrect) {
                correctIndex.push(index);
            }
        });
        const isCorrect = question.type === 'single-choice' ? optionIndex === question.options.findIndex(option => option.isCorrect)
            : optionIndex.sort().toString() === correctIndex.sort().toString();
        if (isCorrect) {
            earnPoints += question.points;
        }
    });

    // Map the answers to the answer Result Schema
    const answersResult = []
    questions.forEach(question => {
        const optionIndex = answers[question._id];

        const correctIndex = [] // Index of correct options for multiple-choice question
        question.options.forEach((option, index) => {
            if (option.isCorrect) {
                correctIndex.push(index);
            }
        });
        const isCorrect = question.type === 'single-choice' ? optionIndex === question.options.findIndex(option => option.isCorrect)
            : optionIndex.sort().toString() === correctIndex.sort().toString();
        
        answersResult.push({
            questionId: question._id,
            selectedOptions: optionIndex,
            isCorrect: isCorrect
        });
    });
    // Update Roadmap
    const roadmap = await Roadmap.findOne({ 'creator': userId });
    if (!roadmap) {
        return next(new ErrorResponse(`Roadmap not found with id of ${userId}`, 404));
    }
    const phase = roadmap.phases.find(phase => phase.items.some(item => item.test == testId));
    const item = phase.items.find(item => item.test == testId);
    if (earnPoints >= test.passingScore) {
        item.completed = true;
    }
    await roadmap.save();

    // Save the test result
    let testResult = await UserTestResult.findOne({ userId: userId, testId: testId });
    console.log(testResult);
    if(!testResult) {
        testResult = await UserTestResult.create({
            userId: userId,
            testId: testId,
            passed: earnPoints >= test.passingScore,
            attempts: [{
                score: earnPoints,
                passed: earnPoints >= test.passingScore,
                answers: answersResult,
                timeTaken: timeTaken
            }]
        });
    }
    else {
        testResult.passed = earnPoints >= test.passingScore ? true : testResult.passed;
        testResult.attempts.push({
            attemptNumber: testResult.attempts.length + 1,
            score: earnPoints,
            passed: earnPoints >= test.passingScore,
            answers: answersResult,
            timeTaken: timeTaken
        });
        await testResult.save();
    }
    console.log(testResult);
    res.json({ success: true, data: testResult });
});

const getReviewTest = asyncHandler(async (req, res, next) => {
    const { testId } = req.query;
    const userId = req.user._id;
    const testResult = await UserTestResult
        .findOne({ userId: userId, testId: testId });
    if (!testResult) {
        return next(new ErrorResponse(`Test Result not found with id of ${testId}`, 404));
    }
    res.json({ success: true, data: testResult });
});

const updateRoadmap = asyncHandler(async (req, res, next) => {
    const { roadmapId } = req.params;
    const roadmap = await Roadmap.findById(roadmapId);
    if (!roadmap) {
        return next(new ErrorResponse(`Roadmap not found with id of ${roadmapId}`, 404));
    }
    const data = req.body;
    console.log(data);
    roadmap.set(data);
    await roadmap.save();
    res.json({ success: true, data: roadmap });
});

export default { createRoadmap, getRoadmaps, submitTest, createTest, updateRoadmap, getReviewTest };