import Message from '../models/Message.js';
import ErrorResponse from "../utils/ErrorResponse.js";

// @desc    Get all messages
// @route   GET /api/v1/messages
// @access  Private/Admin

export const getMessages = async (req, res, next) => {
    const {conversationId, limit, page} = req.query;
    try {
        const messages = await Message.find({ conversationId }).populate('senderId', 'profile')
                    .sort({ createdAt: -1 })
                    .limit(limit)
                    .skip((page - 1) * limit)
                    .lean();
        res.status(200).json({ success: true, data: messages.reverse() });
    }
    catch (error) {
        console.log(error);
        return next(new ErrorResponse('Internal server error', 500));
    }
}