import { Module, ModuleItem } from '../models/Module.js';
import Course from '../models/Course.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import ErrorResponse from '../utils/ErrorResponse.js';
import mongoose from "mongoose";

import Quiz from '../models/Quiz.js';
import ProgramProblem from '../models/ProgramProblem.js';
import { request } from 'express';
import File from '../models/File.js';
import dotevn from 'dotenv';
import minioClient from '../config/minioClient.js';

import Progress from "../models/Progress.js";

//@desc get all modules by course ID
//@route GET /api/v1/learns/courseID/modules/
//@access Public
export const getModulesByCourseId = asyncHandler(async (req, res, next) => {

    const courseId = req.params.id;
    const course = await Course.findOne({ courseId: courseId });
    if (!course) {
        return next(new ErrorResponse(`No found course with id ${courseId}`, 404));
    }
    const modules = await Module.find({ courseId: course._id })
        .populate({
            path: 'moduleItems', // Populates the moduleItems field
            populate: [
                { path: 'video', model: 'Video' },      // Populate related video document in moduleItems
                { path: 'quiz', model: 'Quiz' },        // Populate related quiz document in moduleItems
                { path: 'programming', model: 'ProgramProblem' }  // Populate programming if needed
            ]
        })
        .exec();
    if (!modules || modules.length === 0) {
        return next(new ErrorResponse(`No modules found for this course ${courseId}`, 404));
    }

    console.log('Modules:', modules);

    res.status(200).json(modules);
})

//@desc get single module by course ID and module ID
//@route GET /api/v1/learns/modules/:id
//@access Public

export const getModuleById = asyncHandler(async (req, res, next) => {
    const moduleId = req.params.id;
    console.log('Module ID:', moduleId);
    // Lấy module và populate moduleItems
    const module = await Module.findById(moduleId).populate('moduleItems');
    if (!module) {
        return next(new ErrorResponse(`Module not found with id of ${moduleId}`, 404));
    }

    // Tìm Progress của người dùng cho module
    const userProgress = await Progress.findOne({
        userId: req.user._id,
        moduleId: moduleId
    });

    // Nếu không có progress, mặc định tất cả moduleItems chưa được hoàn thành
    const moduleItemsWithProgress = module.moduleItems.map(item => {
        // Tìm trạng thái hoàn thành của từng moduleItem trong Progress (nếu có)
        const itemProgress = userProgress?.moduleItemProgresses.find(
            progress => progress.moduleItemId.toString() === item._id.toString()
        );

        return {
            ...item.toObject(),
            status: itemProgress?.status || 'not-started',
            attempts: itemProgress?.attempts || 0,
            timeSpent: itemProgress?.timeSpent || 0,
            completedAt: itemProgress?.completedAt || null
        };
    });

    // Tính phần trăm hoàn thành của module
    const completionPercentage = userProgress?.completionPercentage

    res.status(200).json({
        success: true,
        data: {
            module: {
                ...module.toObject(),
                moduleItems: moduleItemsWithProgress,
                completionPercentage
            },
        }
    });
});


/**
 * @desc    Create new module for a course
 * @route   POST /api/v1/learns/:courseId/modules
 * @access  Private
 */
export const createModule = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    // 1. Tìm course bằng courseId (string)
    const course = await Course.findOne({ courseId: id });
    if (!course) {
        return next(new ErrorResponse(`Not found course with id ${id}`, 404));
    }

    // 2. Tạo object chứa dữ liệu module mới
    const moduleData = {
        ...req.body,
        courseId: course._id  // Sử dụng _id của course thay vì courseId string
    };

    // 3. Tự động tạo index nếu không có
    if (!moduleData.index) {
        const moduleCount = await Module.countDocuments({ courseId: course._id });
        moduleData.index = (moduleCount + 1).toString();
    }

    // 4. Validate title
    if (!moduleData.title) {
        return next(new ErrorResponse('Please enter title module', 400));
    }

    try {
        // 5. Tạo module mới
        const newModule = await Module.create(moduleData);

        // 6. Cập nhật course với module mới
        await Course.findByIdAndUpdate(
            course._id,  // Sử dụng _id của course
            {
                $push: { modules: newModule._id }
            },
            { new: true }
        );

        // 7. Trả về response
        res.status(201).json({
            success: true,
            data: newModule,
            message: 'Create module successfully'
        });
    } catch (error) {
        console.error('Error creating module:', error);

        if (error.code === 11000) {
            return next(new ErrorResponse('Duplicate index', 400));
        }
        return next(error);
    }
});
//@desc Update module
//@route PUT /api/v1/modules/:id
//@access Private
//@desc Update module
//@route PUT /api/v1/modules/:id
//@access Private
export const updateModule = asyncHandler(async (req, res, next) => {
    const courseId = req.params.id;
    const { moduleId } = req.params;

    // Find the course
    const course = await Course.findOne({ courseId: courseId });
    if (!course) {
        return next(new ErrorResponse(`No found course with id ${courseId}`, 404));
    }

    // Find all modules for the course
    const modules = await Module.find({ courseId: course._id }).populate('moduleItems');
    let moduleToUpdate = modules.find(module => module.index === moduleId);

    if (!moduleToUpdate) {
        return next(new ErrorResponse(`Module not found with id of ${req.params.id}`, 404));
    }

    // Check authorization
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`User is not authorized to update this module`, 401));
    }

    // Update the module
    const updatedModule = await Module.findOneAndUpdate(
        { index: moduleId },
        req.body,
        {
            new: true,
            runValidators: true
        },
        console.log("Updated module", req.body)
    );

    res.status(200).json({
        success: true,
        data: updatedModule
    });
});

//@desc Delete a module
//@route DELETE /api/v1/modules/:id
//@access Private
export const deleteModule = asyncHandler(async (req, res, next) => {
    const courseId = req.params.id;
    const moduleId = req.params.moduleId;
    // Find course
    const course = await Course.findOne({ courseId: courseId });
    if (!course) {
        return next(new ErrorResponse(`No course found with id ${courseId}`, 404));
    }

    // Find module to delete
    const moduleToDelete = await Module.findOne({
        courseId: course._id,
        index: moduleId
    });

    if (!moduleToDelete) {
        return next(new ErrorResponse(`Module not found with id ${moduleId}`, 404));
    }

    // Check authorization
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`User is not authorized to delete this module`, 401));
    }

    // Get all modules for the course
    const modules = await Module.find({ courseId: course._id }).sort({ index: 1 });

    // Convert string indices to numbers
    const deletedIndex = parseInt(moduleToDelete.index);

    // Start a session for transaction
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            // Delete the module
            await moduleToDelete.deleteOne({ session });

            // Update indices of remaining modules
            for (const mod of modules) {
                const currentIndex = parseInt(mod.index);
                if (currentIndex > deletedIndex) {
                    await Module.findByIdAndUpdate(
                        mod._id,
                        { $set: { index: (currentIndex - 1).toString() } },
                        { session }
                    );
                }
            }
        });

        await session.commitTransaction();
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        await session.abortTransaction();
        return next(new ErrorResponse('Error deleting module', 500));
    } finally {
        session.endSession();
    }
});


export const getAllModuleByModuleItemId = asyncHandler(async (req, res, next) => {
    const { itemId } = req.params;
    console.log('Module item ID:', itemId);

    try {
        // Find the module item first
        const moduleItem = await ModuleItem.findById(itemId);
        console.log('Module Item:', moduleItem);

        if (!moduleItem) {
            return next(new ErrorResponse(`No module item found with ID ${itemId}`, 404));
        }

        // Find the module
        const module = await Module.findById(moduleItem.module);
        console.log('Module:', module);

        if (!module) {
            return next(new ErrorResponse(`No module found for module item ${itemId}`, 404));
        }

        // Return all modules for the course
        const course = await Course.findById(module.courseId).populate('modules');
        console.log('Course:', course);


        console.log('Modules:', course.modules);

        res.status(200).json({
            success: true,
            count: course.modules.length,
            data: course.modules
        });
    } catch (error) {
        console.error('Error in getAllModuleByModuleItemId:', error);
        next(new ErrorResponse('Error retrieving modules', 500));
    }
});


export const getModuleByModuleItemId = asyncHandler(async (req, res, next) => {
    const { itemId } = req.params;

    try {
        // Find the module item first
        const moduleItem = await ModuleItem.findById(itemId);
        console.log('Module Item:', moduleItem);

        if (!moduleItem) {
            return next(new ErrorResponse(`No module item found with ID ${itemId}`, 404));
        }

        // Find the module
        const module = await Module.findById(moduleItem.module).populate('moduleItems');
        console.log('Module:', module);

        if (!module) {
            return next(new ErrorResponse(`No module found for module item ${itemId}`, 404));
        }



        res.status(200).json({
            success: true,
            count: module.length,
            data: module
        });
    } catch (error) {
        console.error('Error in getAllModuleByModuleItemId:', error);
        next(new ErrorResponse('Error retrieving modules', 500));
    }
});
