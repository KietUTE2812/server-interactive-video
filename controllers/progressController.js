import Progress from '../models/Progress.js';
import { Module, ModuleItem } from '../models/Module.js';
import mongoose from 'mongoose';
import ErrorResponse from '../utils/ErrorResponse.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import Course from '../models/Course.js';



// @desc    Update progress
// @route   PUT /api/v1/progress/:id/video
// @access  Private
const updateVideoProgress = async (req, res, next) => {
    const { progressVideo } = req.body;
    const { id } = req.params;
    const userId = req.user.id;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const progress = await Progress.findById(id).populate('moduleItemProgresses.moduleItemId').session(session); // Find the progress of the user
        const module = await Module.findById(progress.moduleId).populate('moduleItems').session(session); // Find the module associated with the progress
        const videoId = progressVideo.videoId; // Extract the videoId from the request body
        console.log(module, progress, videoId)
        // Check if the videoId exists in the module's moduleItems
        const moduleItem = module.moduleItems.find((item) => item.video.toString() === videoId)
        if (!moduleItem) throw new Error('Video not found in the module')

        // Check if the video is already completed
        const videoProgress = progress.moduleItemProgresses.find((item) => item.moduleItemId._id.toString() === moduleItem._id.toString())
        if (videoProgress && videoProgress.status === 'completed') throw new Error('Video already completed')

        // Update the progress for the video
        if (videoProgress) {
            videoProgress.status = progressVideo.completionPercentage === 100 ? 'completed' : 'in-progress';
            videoProgress.moduleItemId = moduleItem._id;
            videoProgress.completedAt = progressVideo.completionPercentage === 100 ? new Date() : null;
            videoProgress.timeSpent = progressVideo?.timeSpent || videoProgress.timeSpent;
            videoProgress.attempts = progressVideo?.attempts || videoProgress.attempts;
            videoProgress.result.video = progressVideo
            // Save the progress
            progress.moduleItemProgresses = progress.moduleItemProgresses.map((item) => item._id.toString() === videoProgress._id.toString() ? videoProgress : item)
            progress.status = progress.completionPercentage === 100 ? 'completed' : 'in-progress';
            await progress.save({ session });
        } else {
            // Create a new progress for the video
            const newProgress = {
                moduleItemId: moduleItem._id,
                status: progressVideo.completionPercentage === 100 ? 'completed' : 'in-progress',
                startedAt: new Date(),
                completedAt: progressVideo.completionPercentage === 100 ? new Date() : null,
                timeSpent: progressVideo?.timeSpent || 0,
                attempts: progressVideo?.attempts || 0,
                result: {
                    video: progressVideo
                }
            }
            progress.moduleItemProgresses.push(newProgress)
            progress.status = progress.completionPercentage === 100 ? 'completed' : 'in-progress';
            await progress.save({ session });
            await session.commitTransaction();

            res.status(200).json({ success: true, data: progress });
        }


    } catch (error) {
        await session.abortTransaction();
        return next(new ErrorResponse(error.message, 400));
    } finally {
        session.endSession();
    }
};

// @desc    Update progress Supplement
// @route   PUT /api/v1/progress/:id/supplement
// @access  Private
const updateSupplementProgress = async (req, res, next) => {
    const { progressSupplement } = req.body;
    const { id } = req.params;
    const userId = req.user.id;
    const session = await mongoose.startSession();
    session.startTransaction();

    const progress = await Progress.findById(id).populate('moduleItemProgresses.moduleItemId').session(session); // Find the progress of the user
    const module = await Module.findById(progress.moduleId).populate('moduleItems').session(session); // Find the module associated with the progress
    const supplementId = progressSupplement.supplementId; // Extract the supplementId from the request body
    // Check if the supplementId exists in the module's moduleItems
    const moduleItem = module.moduleItems.find((item) => item._id.toString() === supplementId)
    if (!moduleItem) return next(new ErrorResponse('Supplement not found in the module', 404))

    // Check if the supplement is already completed
    const supplementProgress = progress.moduleItemProgresses.find((item) => item.moduleItemId.toString() === moduleItem._id.toString())
    console.log(progress, moduleItem, supplementProgress)
    if (supplementProgress && supplementProgress.status === 'completed') return next(new ErrorResponse('Supplement already completed', 400))

    // Update the progress for the supplement
    if (supplementProgress) {
        supplementProgress.status = progressSupplement.status;
        progress.moduleItemProgresses = progress.moduleItemProgresses.map((item) => item._id.toString() === supplementProgress._id.toString() ? supplementProgress : item) // Update the progress for the supplement
        await progress.save({ session });
        res.status(200).json({ success: true, data: progress });
    }
    else {
        // Create a new progress for the supplement
        const newProgress = {
            moduleItemId: moduleItem._id,
            status: progressSupplement.status,
        }
        progress.moduleItemProgresses.push(newProgress)
        await progress.save({ session });
        res.status(200).json({ success: true, data: progress });
    }
    await session.commitTransaction();
}

const createOrGetModuleProgress = asyncHandler(async (userId, moduleId, courseId, session) => {
    try {
        // Sử dụng findOneAndUpdate với option upsert để đảm bảo tạo duy nhất
        const moduleProgress = await Progress.findOneAndUpdate(
            {
                userId: userId,
                moduleId: moduleId,
                courseId: courseId
            },
            {
                $setOnInsert: {
                    userId: userId,
                    moduleId: moduleId,
                    courseId: courseId,
                    status: 'in-progress',
                    moduleItemProgresses: []
                }
            },
            {
                new: true,      // Trả về document mới sau khi update
                upsert: true,   // Tạo mới nếu không tồn tại
                session: session // Sử dụng session của transaction
            }
        );

        return moduleProgress;
    } catch (error) {
        console.error('Error creating or getting module progress:', error);
        return (next(new ErrorResponse('Error creating or getting module progress', 500)));
    }
});

const findOrCreateModuleItemProgress = (moduleProgress, moduleItemId) => {
    // Tìm moduleItemProgress với moduleItemId đã cho
    const existingItemProgress = moduleProgress.moduleItemProgresses.find(
        item => item.moduleItemId.toString() === moduleItemId.toString()
    );

    // Nếu đã tồn tại, trả về item đó
    if (existingItemProgress) {
        return existingItemProgress;
    }

    // Nếu chưa tồn tại, tạo mới 
    const newModuleItemProgress = {
        moduleItemId: moduleItemId,
        status: 'in-progress',
        attempts: 0,
        timeSpent: 0,
        startedAt: Date.now(),
        completedAt: null,
        result: {
            programming: {},
            quiz: {},
            reading: {},
            video: {}
        }
    };

    // Thêm vào mảng moduleItemProgresses
    moduleProgress.moduleItemProgresses.push(newModuleItemProgress);

    // Trả về moduleItemProgress mới tạo
    return newModuleItemProgress;
};


const updateProgrammingProgress = asyncHandler(async (req, res, next) => {
    const { progressProgramming, moduleItemId, moduleId } = req.body;
    const { id } = req.params;
    const userId = req.user.id;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const module = await Module.findById(moduleId);
        if (!module) {
            return next(ErrorResponse('Module not found', 404));
        }

        const course = await Course.findOne({ modules: moduleId });
        if (!course) {
            return next(ErrorResponse('Course not found', 404));
        }

        // Sử dụng phương thức mới để tạo hoặc lấy progress
        const moduleProgress = await createOrGetModuleProgress(
            userId,
            moduleId,
            course._id,
            session
        );

        //console.log("moduleProgress", moduleProgress);
        // Các thao tác tiếp theo với moduleProgress

        const moduleItemProgress = findOrCreateModuleItemProgress(moduleProgress, moduleItemId);

        //console.log("moduleItemProgress", moduleItemProgress);


        await moduleProgress.save();
        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            success: true,
            moduleItemProgress: moduleItemProgress,
            moduleProgress: moduleProgress
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        return next(error);
    }

    // if (moduleProgress.status === 'completed') {
    //     return next(new ErrorResponse('Module is already completed', 400));
    // }

    // Tìm hoặc tạo moduleItemProgress
    // let moduleItemProgress = moduleProgress.moduleItemProgresses.find(
    //     item => item.moduleItemId.toString() === id.toString()
    // );

    // let moduleItemProgressIndex = moduleItemProgress ? moduleProgress.moduleItemProgresses.indexOf(moduleItemProgress) : -1;


    // if (!moduleItemProgress) {
    //     moduleItemProgress = {
    //         moduleItemId: id,
    //         status: 'in-progress',
    //         startedAt: new Date(),
    //         attempts: 0,
    //         timeSpent: 0,
    //         result: {}
    //     };
    //     moduleProgress.moduleItemProgresses.push(moduleItemProgress);
    //     moduleItemProgressIndex = moduleProgress.moduleItemProgresses.length - 1;

    // }

    // moduleItemProgress.attempts += 1;
    // moduleItemProgress.timeSpent += timeSpent;
    // moduleItemProgress.status = isPassed ? 'completed' : 'in-progress';

});

const getProgrammingProgressByProblemId = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user.id;
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const moduleItem = await ModuleItem.findOne({ programming: id });
        if (!moduleItem) return next(new ErrorResponse('ModuleItem not found', 404));
        //console.log("moduleItem: ", moduleItem);

        const module = await Module.findById(moduleItem.module);
        if (!module) {
            return next(ErrorResponse('Module not found', 404));
        }

        const course = await Course.findOne({ modules: module._id });
        if (!course) {
            return next(ErrorResponse('Course not found', 404));
        }

        const moduleProgress = await createOrGetModuleProgress(
            userId,
            module._id,
            course._id,
            session
        );

        //console.log("moduleProgress", moduleProgress);
        // Các thao tác tiếp theo với moduleProgress

        const moduleItemProgress = findOrCreateModuleItemProgress(moduleProgress, moduleItem._id);

        //console.log("moduleItemProgress", moduleItemProgress);


        await moduleProgress.save();
        await session.commitTransaction();
        session.endSession();
        return res.status(200).json({
            success: true,
            moduleItemProgress: moduleItemProgress,
            moduleProgress: moduleProgress
        })
    }
    catch (err) {
        console.log(err);
        return (next(ErrorResponse('Error creating or getting module progress', 500)));
    }
    finally {
        session.endSession();
    }



});
export default { updateVideoProgress, updateSupplementProgress, updateProgrammingProgress, getProgrammingProgressByProblemId };