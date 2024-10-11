import { Module, ModuleItem } from '../models/Module.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import ErrorResponse from '../utils/ErrorResponse.js';

//@desc Get all modules
//@route GET /api/v1/modules
//@access Public
export const getModules = asyncHandler(async (req, res, next) => {
    const modules = await Module.find().populate('moduleItems');
    res.status(200).json({ success: true, count: modules.length, data: modules });
});

//@desc Get single module
//@route GET /api/v1/modules/:id
//@access Public
export const getModule = asyncHandler(async (req, res, next) => {
    const module = await Module.findById(req.params.id).populate('moduleItems');
    if (!module) {
        return next(new ErrorResponse(`Module not found with id of ${req.params.id}`, 404));
    }

    res.status(200).json({ success: true, data: module });
});

//@desc Create new module
//@route POST /api/v1/modules
//@access Private
export const createModule = asyncHandler(async (req, res, next) => {
    const module = await Module.create(req.body);
    res.status(201).json({ success: true, data: module });
});

//@desc Update module
//@route PUT /api/v1/modules/:id
//@access Private
export const updateModule = asyncHandler(async (req, res, next) => {
    let module = await Module.findById(req.params.id);
    if (!module) {
        return next(new ErrorResponse(`Module not found with id of ${req.params.id}`, 404));
    }

    const course = await Course.findById(module.courseId);
    if (!course) {
        return next(new ErrorResponse(`Course not found for the module`, 404));
    }
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`User is not authorized to update this module`, 401));
    }

    module = await Module.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });
    res.status(200).json({ success: true, data: module });
});

//@desc Delete a module
//@route DELETE /api/v1/modules/:id
//@access Private
export const deleteModule = asyncHandler(async (req, res, next) => {
    const module = await Module.findById(req.params.id);
    if (!module) {
        return next(new ErrorResponse(`Module not found with id of ${req.params.id}`, 404));
    }

    const course = await Course.findById(module.courseId);
    if (!course) {
        return next(new ErrorResponse(`Course not found for the module`, 404));
    }
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`User is not authorized to update this module`, 401));
    }

    await module.remove();
    res.status(200).json({ success: true, data: {} });
});

// Module Items

//@desc Get all module items
//@route GET /api/v1/moduleItems
//@access Public
export const getModuleItems = asyncHandler(async (req, res, next) => {
    const moduleItems = await ModuleItem.find();
    res.status(200).json({ success: true, count: moduleItems.length, data: moduleItems });
});

//@desc Get single module item
//@route GET /api/v1/moduleItems/:id
//@access Public
export const getModuleItem = asyncHandler(async (req, res, next) => {
    const moduleItem = await ModuleItem.findById(req.params.id);
    if (!moduleItem) {
        return next(new ErrorResponse(`ModuleItem not found with id of ${req.params.id}`, 404));
    }
    res.status(200).json({ success: true, data: moduleItem });
});

//@desc Create new module item
//@route POST /api/v1/moduleItems
//@access Private
export const createModuleItem = asyncHandler(async (req, res, next) => {
    const moduleItem = await ModuleItem.create(req.body);
    res.status(201).json({ success: true, data: moduleItem });
});

//@desc Update module item
//@route PUT /api/v1/moduleItems/:id
//@access Private
export const updateModuleItem = asyncHandler(async (req, res, next) => {
    let moduleItem = await ModuleItem.findById(req.params.id);
    if (!moduleItem) {
        return next(new ErrorResponse(`ModuleItem not found with id of ${req.params.id}`, 404));
    }

    const module = await Module.findById(moduleItem.moduleId);

    if (!module) {
        return next(new ErrorResponse(`Module not found for the module item`, 404));
    }
    const course = await Course.findById(module.courseId);

    if (!course) {
        return next(new ErrorResponse(`Course not found for the module`, 404));
    }
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`User is not authorized to update this module item`, 401));
    }

    moduleItem = await ModuleItem.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });
    res.status(200).json({ success: true, data: moduleItem });
});

//@desc Delete a module item
//@route DELETE /api/v1/moduleItems/:id
//@access Private
export const deleteModuleItem = asyncHandler(async (req, res, next) => {
    const moduleItem = await ModuleItem.findById(req.params.id);
    if (!moduleItem) {
        return next(new ErrorResponse(`ModuleItem not found with id of ${req.params.id}`, 404));
    }

    const module = await Module.findById(moduleItem.moduleId);

    if (!module) {
        return next(new ErrorResponse(`Module not found for the module item`, 404));
    }
    const course = await Course.findById(module.courseId);

    if (!course) {
        return next(new ErrorResponse(`Course not found for the module`, 404));
    }
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`User is not authorized to update this module item`, 401));
    }

    await moduleItem.remove();
    res.status(200).json({ success: true, data: {} });
});