// import Video from '../models/Video.js';
// import {Module, ModuleItem} from '../models/Module.js';
// import ErrorResponse from '../utils/errorResponse.js';
// import miniO from "../utils/uploadToMiniO.js";

// const generateVideoName = (title) => {
//     const name = title.replace(/\s+/g, '-').toLowerCase();
//     return `${name}-${Date.now()}.mp4`;
// }
// // @desc    Create a video
// // @route   POST /api/v1/modules/:moduleId/videos
// const createVideo = async (req, res, next) => {
//     const { moduleId } = req.params;
//     const file = req.file;
//     const { title, references, duration, description } = req.body;
//     if (!file) {
//         return res.status(400).send('No file uploaded.');
//     }
//     const module = await Module.findById(moduleId);
//     if(!module) {
//         return new ErrorResponse(`Module not found with id of ${moduleId}`, 404);
//     }
//     if(!references.fileName || !references.size || !references.title || !references.file) {
//         return new ErrorResponse(`Please provide a valid reference`, 400);
//     }
//     const videoStream = file
//     const videoName = generateVideoName(title);
//     let videoUrl = null
//     try {
//         miniO.uploadStream(videoName, videoStream.buffer, videoStream.size).then((result) => {
//             videoUrl = result?.objectName;
//         }).catch((error) => {
//             next(new ErrorResponse(`Error uploading video to storage ${error}`, 500));
//         })
//     } catch (error) {
//         next(new ErrorResponse(`Error uploading video to storage`, 500));
//     }
//     console.log(videoUrl);
// }

// export default { createVideo }