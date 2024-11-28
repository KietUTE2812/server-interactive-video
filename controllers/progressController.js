import Progress from '../models/Progress.js';
import  { Module,ModuleItem } from '../models/Module.js';
import mongoose from 'mongoose';
import ErrorResponse from '../utils/ErrorResponse.js';


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
    console.log(progress,moduleItem,supplementProgress)
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

// @desc    Get progress
// @route   GET /api/v1/progress
// @access  Private
const getProgress = async (req, res, next) => {
    const userId = req.user._id;
    const courseId = req.query.courseId;
    console.log(userId, courseId)
    const progress = await Progress.find({ userId, courseId }).populate('moduleItemProgresses.moduleItemId').populate('moduleId', 'title');
    if (!progress) return next(new ErrorResponse('Progress not found', 404))
    const count = progress.length;
    res.status(200).json({ success: true, count, data: progress });
}

export default { updateVideoProgress, updateSupplementProgress, getProgress };