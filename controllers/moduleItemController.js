import { Module, ModuleItem, Video } from '../models/Module.js';
import Course from '../models/Course.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import ErrorResponse from '../utils/ErrorResponse.js';
import mongoose from "mongoose";
import Quiz from '../models/Quiz.js';
import ProgramProblem from '../models/ProgramProblem.js';
import { request } from 'express';
import File from '../models/File.js';
import dotenv from 'dotenv';
import minioClient from '../config/minioClient.js';

// Module Items

//@desc Create module item type supplement 
//@route POST /api/v1/learns/:courseId/modules/:moduleId/supplements
//@access Private
export const createModuleItemSupplement = asyncHandler(async (req, res, next) => {
    const courseId = req.params.id;
    const moduleId = req.params.moduleId;
    const { title, description } = req.body;

    // Validate inputs
    if (!title || !description) {
        return next(new ErrorResponse('Please provide title and description', 400));
    }

    if (!req.file) {
        return next(new ErrorResponse('Please provide a file', 400));
    }

    // Find the course
    const course = await Course.findById(courseId);
    if (!course) {
        return next(new ErrorResponse(`No found course with id ${courseId}`, 404));
    }

    // Find the module
    const module = await Module.findOne({ courseId: course._id, index: moduleId });
    if (!module) {
        return next(new ErrorResponse(`No found module with id ${moduleId}`, 404));
    }

    // Check authorization
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`User is not authorized to create module item`, 401));
    }
    const bucketName = process.env.MINIO_BUCKET_NAME;
    const objectName = Date.now() + '-' + req.file.originalname;

    const bucketExists = await minioClient.bucketExists(bucketName);
    if (!bucketExists) {
        await minioClient.makeBucket(bucketName, 'us-east-1');
    }

    await minioClient.putObject(
        bucketName,
        objectName,
        req.file.buffer,
        req.file.size,
        {
            'Content-Type': req.file.mimetype
        }
    );
    const url = `${process.env.MINIO_URL}/${objectName}`;


    const session = await mongoose.startSession();
    try {
        // Start transaction
        await session.startTransaction();

        // 1. Create new module item with session
        const moduleItemData = {
            module: module._id,
            title,
            description,
            type: 'supplement',
            contentType: 'Reading',
            icon: 'read',
            reading: url.toString(),
        };

        // Use create with session in array format as per MongoDB best practices
        await ModuleItem.collection.dropIndexes();
        const [newModuleItem] = await ModuleItem.create([moduleItemData], { session });

        console.log('New module item:', newModuleItem);
        // Update module
        await Module.findByIdAndUpdate(
            module._id,
            {
                $push: { moduleItems: newModuleItem._id }
            },
            {
                session,
                new: true,
                runValidators: true
            }
        );
        await session.commitTransaction();
        res.status(201).json({
            success: true,
            data: newModuleItem
        });
    } catch (error) {
        await session.abortTransaction();
        console.error('Error creating module item:', error);
        return res.status(500).json({
            success: false,
            error: 'Error creating module item',
            details: error.message
        });
        //return next(new ErrorResponse('Error creating module item', 500));
    } finally {
        // Always end session
        session.endSession();
    }
});

export const createModuleItemLecture = asyncHandler(async (req, res, next) => {
    const courseId = req.params.id;
    const moduleId = req.params.moduleId;
    const { title, description } = req.body;

    // Validation checks
    if (!title || !description) {
        return next(new ErrorResponse('Please provide title and description', 400));
    }

    if (!req.file) {
        return next(new ErrorResponse('Please provide a file', 400));
    }

    // Implement retry mechanism
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
        const session = await mongoose.startSession();

        try {
            session.startTransaction({
                readConcern: { level: 'snapshot' },
                writeConcern: { w: 'majority' }
            });

            const course = await Course.findById(courseId).session(session);

            if (!course) {
                await session.abortTransaction();
                return next(new ErrorResponse(`No found course with id ${courseId}`, 404));
            }
            const module = await Module.findOne({
                courseId: course._id,
                index: moduleId
            }).session(session);

            if (!module) {
                await session.abortTransaction();
                return next(new ErrorResponse(`No found module with id ${moduleId}`, 404));
            }

            // Authorization check
            if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
                await session.abortTransaction();
                return next(new ErrorResponse(`User is not authorized to create module item`, 401));
            }

            // Upload to MinIO with error handling
            const bucketName = process.env.MINIO_BUCKET_NAME;
            const objectName = `${Date.now()}-${req.file.originalname}`;

            try {
                const bucketExists = await minioClient.bucketExists(bucketName);
                if (!bucketExists) {
                    await minioClient.makeBucket(bucketName, 'us-east-1');
                }

                await minioClient.putObject(
                    bucketName,
                    objectName,
                    req.file.buffer,
                    req.file.size,
                    { 'Content-Type': req.file.mimetype }
                );
            } catch (minioError) {
                await session.abortTransaction();
                console.error('MinIO upload error:', minioError);
                return next(new ErrorResponse('Error uploading file', 500));
            }

            // Process questions
            let questionData = req.body.questions;
            try {
                if (typeof questionData === 'string') {
                    questionData = JSON.parse(questionData);
                }
            } catch (parseError) {
                await session.abortTransaction();
                return next(new ErrorResponse('Invalid questions format', 400));
            }

            const questionsArray = Array.isArray(questionData) ? questionData : [questionData];
            const validQuestions = questionsArray
                .filter(q => q.index !== null && q.question !== null && q.answers?.length > 0)
                .map(q => ({
                    ...q,
                    answers: q.answers.filter(a => a.content !== null && a.isCorrect !== null)
                }));

            // Create video document
            const url = `${process.env.MINIO_URL}/${objectName}`;
            const videoData = {
                file: url.toString(),
                duration: req.body.duration,
                questions: validQuestions,
            };

            const video = await Video.create([videoData], { session });

            // Create module item
            const moduleItemData = {
                module: module._id,
                title,
                description,
                type: 'lecture',
                contentType: 'Video',
                icon: 'video',
                video: video[0]._id,
            };

            const newModuleItem = await ModuleItem.create([moduleItemData], { session });

            // Update module with new item
            await Module.findByIdAndUpdate(
                module._id,
                { $push: { moduleItems: newModuleItem[0]._id } },
                { session, new: true, runValidators: true }
            );

            await session.commitTransaction();

            return res.status(201).json({
                success: true,
                data: newModuleItem[0]
            });

        } catch (error) {
            await session.abortTransaction();

            if (error.code === 11000) {
                retryCount++;
                // Wait before retrying with exponential backoff
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
                continue;
            }

            console.error('Transaction error:', error);
            return next(new ErrorResponse('Error creating module item', 500));
        } finally {
            session.endSession();
        }
    }

    // If we've exhausted all retries
    return next(new ErrorResponse('Failed to create module item after multiple attempts', 500));
});

export const createModuleItemQuiz = asyncHandler(async (req, res, next) => {
    const courseId = req.params.id;
    const moduleId = req.params.moduleId;

    // Find the course
    const course = await Course.findById(courseId);
    if (!course) {
        return next(new ErrorResponse(`No found course with id ${courseId}`, 404));
    }

    // Find the module
    const module = await Module.findOne({ courseId: course._id, index: moduleId });
    if (!module) {
        return next(new ErrorResponse(`No found module with id ${moduleId}`, 404));
    }

    const quizData = {
        ...req.body,
        module: module._id
    }
    if (!quizData || !quizData.questions || !Array.isArray(quizData.questions)) {
        return next(new ErrorResponse('Please provide valid quiz data with questions array', 400));
    }
    // Check authorization
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`User is not authorized to create module item`, 401));
    }

    // Use mongoose transaction to ensure data consistency


    try {
        // Create new module item
        // await ModuleItem.collection.dropIndex("moduleId_1");
        //await ModuleItem.collection.dropIndexes();
        const newmoduleItem = await ModuleItem.create(quizData);
        console.log('Module item:', newmoduleItem);
        //await Quiz.collection.dropIndexes();
        const newQuiz = await Quiz.create({
            moduleItem: newmoduleItem._id,
            duration: quizData.duration,
            passingScore: quizData.passingScore,
            questions: formatQuestionData(quizData.questions),
        })
        console.log('quiz', newQuiz);

        await ModuleItem.findByIdAndUpdate(
            newmoduleItem._id,
            { quiz: newQuiz._id },
            { new: true }
        )

        await Module.findByIdAndUpdate(module._id,
            { $push: { moduleItems: newmoduleItem._id } },
            { new: true }
        )


        res.status(201).json({
            success: true,
            data: newmoduleItem
        });
    } catch (error) {
        console.error('Error creating quiz module item:', error);
        return next(new ErrorResponse(error.message, 400));
    }
});

// Helper function to format question data
function formatQuestionData(questions) {
    return questions.map(question => ({
        orderNumber: question.orderNumber,
        content: question.content,
        type: question.type,
        points: question.points || 1,
        answers: question.answers.map(answer => ({
            content: answer.content,
            isCorrect: answer.isCorrect
        })),
        explanation: question.explanation
    }));
}

export const createModuleItemProgramming = asyncHandler(async (req, res, next) => {
    const courseId = req.params.id;
    const moduleId = req.params.moduleId;

    // Find the course
    const course = await Course.findById(courseId);
    if (!course) {
        return next(new ErrorResponse(`No found course with id ${courseId}`, 404));
    }

    // Find the module
    const module = await Module.findOne({ courseId: course._id, index: moduleId });
    if (!module) {
        return next(new ErrorResponse(`No found module with id ${moduleId}`, 404));
    }

    const formData = {
        ...req.body,
        module: module._id
    }
    //console.log("user", req.user.id)
    //console.log('formData', formData);
    // Check authorization
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`User is not authorized to create module item`, 401));
    }

    try {
        await ProgramProblem.collection.dropIndexes();
        const newModuleItem = await ModuleItem.create({
            module: module._id,
            title: formData.title,
            description: formData.description,
            type: 'programming',
            contentType: 'Programming Assignment',
            icon: 'code',
            isGrade: formData.isGrade,

        });

        const newProgram = await ProgramProblem.create(
            {
                problemName: formData.problemName,
                content: formData.content,
                difficulty: formData.difficulty,
                tags: formData.tags,
                constraints: formData.constraints,
                inputFormat: formData.inputFormat,
                outputFormat: formData.outputFormat,
                sampleInput: formData.sampleInput,
                sampleOutput: formData.sampleOutput,
                explanation: formData.explanation,
                editorial: formData.editorial,
                testcases: formData.testcases,
                createdBy: req.user.id,
                baseScore: formData.baseScore,
                timeBonus: formData.timeBonus,
                memoryBonus: formData.memoryBonus,
            }
        )

        await ModuleItem.findByIdAndUpdate(
            newModuleItem._id,
            { programming: newProgram._id },
            { new: true }
        )
        await Module.findByIdAndUpdate(module._id,
            { $push: { moduleItems: newModuleItem._id } },
            { new: true }
        )


        res.status(201).json({
            success: true,
            data: newModuleItem
        });
    } catch (error) {
        console.error('Error creating programming module item:', error);
        return next(new ErrorResponse(error.message, 400));
    }
})



//
export const getModuleItemById = asyncHandler(async (req, res, next) => {
    const moduleItemId = req.params.moduleItemId;

    const moduleItem = await ModuleItem.findById(moduleItemId)
        .populate([
            { path: 'video', model: 'Video' },
            { path: 'quiz', model: 'Quiz' },
            { path: 'programming', model: 'ProgramProblem' }
        ]);

    if (!moduleItem) {
        return next(new ErrorResponse(`No module item found with id ${moduleItemId}`, 404));
    }
    // if (moduleItem.reading) {
    //     const bucketName = process.env.MINIO_BUCKET_NAME;
    //     const objectName = moduleItem.reading;
    //     const bucketExists = await minioClient.bucketExists(bucketName);
    //     if (!bucketExists) {
    //         return next(new ErrorResponse('Bucket not found', 404));
    //     }
    //     const url = await minioClient.presignedGetObject(bucketName, objectName, 7 * 24 * 60 * 60);
    //     moduleItem.reading = url;
    // }

    // if (moduleItem.video) {
    //     const bucketName = process.env.MINIO_BUCKET_NAME;
    //     const objectName = moduleItem.video.file;
    //     const bucketExists = await minioClient.bucketExists(bucketName);
    //     if (!bucketExists) {
    //         return next(new ErrorResponse('Bucket not found', 404));
    //     }
    //     const url = await minioClient.presignedGetObject(bucketName, objectName, 7 * 24 * 60 * 60);
    //     moduleItem.video.file = url;
    // }
    res.status(200).json({
        success: true,
        data: moduleItem
    });
});