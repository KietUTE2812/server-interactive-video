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
    
    // Kiểm tra course tồn tại
    const course = await Course.findById(courseId);
    if (!course) {
        return next(new ErrorResponse(`No found course with id ${courseId}`, 404));
    }
    
    // Lấy modules và sắp xếp theo index
    const modules = await Module.find({ courseId: course._id })
        .sort({ index: 1 })  // Sắp xếp theo index tăng dần
        .populate({
            path: 'moduleItems', // Populates the moduleItems field
            populate: [
                { path: 'video', model: 'Video' },      // Populate related video document in moduleItems
                { path: 'quiz', model: 'Quiz' },        // Populate related quiz document in moduleItems
                { path: 'programming', model: 'ProgramProblem' }  // Populate programming if needed
            ]
        })
        .exec();

    // Trả về kết quả
    res.status(200).json({
        success: true,
        count: modules.length,
        data: modules
    });
})

//@desc get single module by course ID and module ID
//@route GET /api/v1/modules/:id
//@access Public
export const getModuleById = asyncHandler(async (req, res, next) => {
    const moduleId = req.params.id;
    
    // Lấy module và populate moduleItems
    const module = await Module.findById(moduleId)
        .populate({
            path: 'moduleItems',
            populate: [
                { path: 'video', model: 'Video' },
                { path: 'quiz', model: 'Quiz' },
                { path: 'programming', model: 'ProgramProblem' }
            ]
        });
        
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
    const completionPercentage = userProgress?.completionPercentage || 0;

    res.status(200).json({
        success: true,
        data: {
            module: {
                ...module.toObject(),
                moduleItems: moduleItemsWithProgress,
                completionPercentage
            },
            progress: userProgress
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
    
    // 1. Tìm course bằng courseId
    const course = await Course.findById(id);
    if (!course) {
        return next(new ErrorResponse(`Not found course with id ${id}`, 404));
    }

    // 2. Kiểm tra quyền
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`User is not authorized to add modules to this course`, 401));
    }

    // 3. Tạo object chứa dữ liệu module mới
    const moduleData = {
        ...req.body,
        courseId: course._id
    };

    // 4. Tự động tạo index nếu không có
    if (!moduleData.index) {
        const moduleCount = await Module.countDocuments({ courseId: course._id });
        moduleData.index = (moduleCount + 1).toString();
    }

    // 5. Validate title
    if (!moduleData.title) {
        return next(new ErrorResponse('Please enter title module', 400));
    }

    try {
        // 6. Tạo module mới
        const newModule = await Module.create(moduleData);

        // 7. Cập nhật course với module mới
        await Course.findByIdAndUpdate(
            course._id,
            { $push: { modules: newModule._id } },
            { new: true }
        );

        // 8. Trả về response
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
/**
 * @desc    Update module
 * @route   PUT /api/v1/learns/:courseId/modules/:moduleId
 * @access  Private
 */
export const updateModule = asyncHandler(async (req, res, next) => {
    const courseId = req.params.id;
    const { moduleId } = req.params;
    
    // 1. Tìm course
    const course = await Course.findById(courseId);
    if (!course) {
        return next(new ErrorResponse(`Course not found with id ${courseId}`, 404));
    }

    // 2. Kiểm tra quyền
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`User is not authorized to update this module`, 401));
    }

    // 3. Tìm module cần cập nhật
    const moduleToUpdate = await Module.findOne({
        courseId: courseId,
        index: moduleId
    });

    if (!moduleToUpdate) {
        return next(new ErrorResponse(`Module not found with index ${moduleId}`, 404));
    }

    // 4. Cập nhật module
    try {
        const updatedModule = await Module.findByIdAndUpdate(
            moduleToUpdate._id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        ).populate('moduleItems');

        // 5. Trả về response
        res.status(200).json({
            success: true,
            data: updatedModule,
            message: 'Module updated successfully'
        });
    } catch (error) {
        console.error('Error updating module:', error);
        return next(new ErrorResponse(`Error updating module: ${error.message}`, 500));
    }
});

/**
 * @desc    Delete a module
 * @route   DELETE /api/v1/learns/:courseId/modules/:moduleId
 * @access  Private
 */
export const deleteModule = asyncHandler(async (req, res, next) => {
    const courseId = req.params.id;
    const moduleId = req.params.moduleId;
    
    // 1. Tìm course
    const course = await Course.findById(courseId);
    if (!course) {
        return next(new ErrorResponse(`Course not found with id ${courseId}`, 404));
    }

    // 2. Tìm module cần xóa
    const moduleToDelete = await Module.findOne({
        courseId: course._id,
        index: moduleId
    });

    if (!moduleToDelete) {
        return next(new ErrorResponse(`Module not found with id ${moduleId}`, 404));
    }

    // 3. Kiểm tra quyền
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`User is not authorized to delete this module`, 401));
    }

    // 4. Lấy tất cả modules của course và sắp xếp theo index
    const modules = await Module.find({ courseId: course._id }).sort({ index: 1 });

    // 5. Chuyển đổi index từ string sang number
    const deletedIndex = parseInt(moduleToDelete.index);

    // 6. Bắt đầu transaction để đảm bảo tính toàn vẹn dữ liệu
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            // 6.1 Lấy danh sách moduleItems để xóa
            const moduleItems = await ModuleItem.find({ module: moduleToDelete._id });
            
            // 6.2 Xóa tất cả quiz, videos, và programming problems liên quan
            for (const item of moduleItems) {
                if (item.type === 'quiz' && item.quiz) {
                    await Quiz.findByIdAndDelete(item.quiz, { session });
                }
                if (item.type === 'lecture' && item.video) {
                    await Video.findByIdAndDelete(item.video, { session });
                }
                if (item.type === 'programming' && item.programming) {
                    await ProgramProblem.findByIdAndDelete(item.programming, { session });
                }
            }
            
            // 6.3 Xóa tất cả moduleItems
            await ModuleItem.deleteMany({ module: moduleToDelete._id }, { session });
            
            // 6.4 Xóa module
            await moduleToDelete.deleteOne({ session });
            
            // 6.5 Xóa module khỏi danh sách modules của course
            await Course.findByIdAndUpdate(
                course._id,
                { $pull: { modules: moduleToDelete._id } },
                { session }
            );

            // 6.6 Cập nhật lại index cho các modules còn lại
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
        
        // 7. Trả về kết quả thành công
        res.status(200).json({ 
            success: true, 
            message: 'Module deleted successfully',
            data: {} 
        });
    } catch (error) {
        // 8. Xử lý lỗi và rollback transaction
        await session.abortTransaction();
        console.error('Error deleting module:', error);
        return next(new ErrorResponse(`Error deleting module: ${error.message}`, 500));
    } finally {
        session.endSession();
    }
});

/**
 * @desc    Get all modules by moduleItemId
 * @route   GET /api/v1/moduleItem/:itemId/modules
 * @access  Public
 */
export const getAllModuleByModuleItemId = asyncHandler(async (req, res, next) => {
    const { itemId } = req.params;

    try {
        // 1. Tìm moduleItem
        const moduleItem = await ModuleItem.findById(itemId);
        
        if (!moduleItem) {
            return next(new ErrorResponse(`No module item found with ID ${itemId}`, 404));
        }

        // 2. Tìm module chứa moduleItem
        const module = await Module.findById(moduleItem.module);
        
        if (!module) {
            return next(new ErrorResponse(`No module found for module item ${itemId}`, 404));
        }

        // 3. Lấy tất cả modules của course
        const course = await Course.findById(module.courseId)
            .populate({
                path: 'modules',
                options: { sort: { index: 1 } }
            });

        // 4. Trả về kết quả
        res.status(200).json({
            success: true,
            count: course.modules.length,
            data: course.modules
        });
    } catch (error) {
        console.error('Error in getAllModuleByModuleItemId:', error);
        next(new ErrorResponse(`Error retrieving modules: ${error.message}`, 500));
    }
});


/**
 * @desc    Get module by moduleItemId
 * @route   GET /api/v1/moduleItem/:itemId/module
 * @access  Public
 */
export const getModuleByModuleItemId = asyncHandler(async (req, res, next) => {
    const { itemId } = req.params;

    try {
        // 1. Tìm moduleItem
        const moduleItem = await ModuleItem.findById(itemId);
        
        if (!moduleItem) {
            return next(new ErrorResponse(`No module item found with ID ${itemId}`, 404));
        }

        // 2. Tìm module chứa moduleItem và populate toàn bộ thông tin
        const module = await Module.findById(moduleItem.module)
            .populate({
                path: 'moduleItems',
                populate: [
                    { path: 'video', model: 'Video' },
                    { path: 'quiz', model: 'Quiz' },
                    { path: 'programming', model: 'ProgramProblem' }
                ]
            });
        
        if (!module) {
            return next(new ErrorResponse(`No module found for module item ${itemId}`, 404));
        }

        // 3. Trả về kết quả
        res.status(200).json({
            success: true,
            data: module
        });
    } catch (error) {
        console.error('Error in getModuleByModuleItemId:', error);
        next(new ErrorResponse(`Error retrieving module: ${error.message}`, 500));
    }
});
