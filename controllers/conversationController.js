import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import ErrorResponse from "../utils/ErrorResponse.js";
export const createConversation = async (req, res, next) => {
    const { participants, type = 'direct', courseId } = req.body;
    console.log(participants, type, courseId);
    if (!participants || !Array.isArray(participants) || participants.length < 2) {
        return next(new ErrorResponse('Please provide at least 2 participants', 400));
    }

    if (type !== 'direct' && type !== 'group') {
        return next(new ErrorResponse('Invalid conversation type', 400));
    }

    try {
        const conversationId = `group-${Date.now()}`;

        const conversation = await Conversation.create({
            conversationId,
            type,
            participants,
            courseId
        });
        const result = await Conversation.findById(conversation._id).populate('participants', 'profile');
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        return next(new ErrorResponse('Internal server error', 500));
    }
}

export const getConversations = async (req, res, next) => {
    const { userId, participants, courseId } = req.query;
    try {
        // Nếu có participants, tìm cuộc hội thoại có các participants trong mảng `participants`
        if (participants) {
            const arrParticipants = participants.split(',');
            const conversations = await Conversation.find({ participants: { $all: arrParticipants }, courseId }).populate('participants', 'profile');
            console.log(conversations[0]._id);
            return res.status(200).json({ success: true, data: conversations });
        }
        // Nếu `userId` tồn tại, tìm các cuộc hội thoại có `userId` trong mảng `participants`
        const filter = userId ? { participants: { $in: [userId] } } : {};
        
        const conversations = await Conversation.find(filter).populate('participants', 'profile').populate('lastMessage').populate('courseId', 'title');
        if(conversations.length === 0) {
            return next(new ErrorResponse(`No conversation found`, 404));
        }

        // Dùng Promise.all để gán lastMessage cho từng cuộc hội thoại
        const conversationsWithLastMessage = await Promise.all(
            conversations.map(async (conversation) => {
                // Chỉ trả về unReadCounts của người dùng hiện tại (userId)
                const unReadCounts = conversation.unReadCounts.get(userId.toString());
                return {
                    ...conversation._doc,
                    unReadCounts: unReadCounts || 0
                }
            })
        );
        res.status(200).json({ success: true, data: conversationsWithLastMessage.sort((a, b) => {
            if (!a.lastMessage) return 1;
            if (!b.lastMessage) return 1;
                return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
            })
        });

    } catch (error) {
        console.log(error);
        return next(new ErrorResponse('Internal server error', 500));
    }
};


export const getConversation = async (req, res, next) => {
    const { conversationId } = req.params;
    const page = parseInt(req.query.page) || 1;  // Trang hiện tại
    const limit = parseInt(req.query.limit) || 20;  // Số lượng tin nhắn mỗi trang

    try {
        const skip = (page - 1) * limit;  // Số lượng tin nhắn bỏ qua
        const conversation = await Conversation.findOne({ conversationId });
        if (!conversation) {
            return next(new ErrorResponse('Conversation not found', 404));
        }
        const messages = await Message.find({ conversationId })
            .sort({ timestamp: -1 })  // Sắp xếp giảm dần để lấy tin nhắn cũ hơn
            .skip(skip)
            .limit(limit);
        res.status(200).json({ success: true, data: {
            conversation,
            messages
        } });
    }
    catch (error) {
        return next(new ErrorResponse('Internal server error', 500));
    }
}
