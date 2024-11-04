import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
export const createConversation = async (req, res) => {
    const { participants, type } = req.body;

    if (!participants || !Array.isArray(participants) || participants.length < 2) {
        return res.status(400).json({ success: false, message: 'Participants must be an array of at least 2 user IDs' });
    }

    if (type !== 'direct' && type !== 'group') {
        return res.status(400).json({ success: false, message: 'Invalid conversation type' });
    }

    try {
        const conversationId = type === 'direct' ? participants.sort().join('-') : `group-${Date.now()}`;

        const conversation = await Conversation.create({
            conversationId,
            type,
            participants
        });

        res.status(201).json({ success: true, data: conversation });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

export const getConversations = async (req, res) => {
    const { userId } = req.query;

    try {
        // Nếu `userId` tồn tại, tìm các cuộc hội thoại có `userId` trong mảng `participants`
        const filter = userId ? { participants: { $in: [userId] } } : {};
        
        const conversations = await Conversation.find(filter).populate('participants', 'profile');

        // Dùng Promise.all để gán lastMessage cho từng cuộc hội thoại
        const conversationsWithLastMessage = await Promise.all(
            conversations.map(async (conversation) => {
                // Tìm tin nhắn cuối cùng của cuộc hội thoại
                const lastMessage = await Message.findOne({ conversationId: conversation._id })
                    .sort({ createdAt: -1 })
                    .lean();

                // Gán lastMessage vào conversation và trả về
                return { ...conversation.toObject(), lastMessage };
            })
        );

        res.status(200).json({ success: true, data: conversationsWithLastMessage });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


export const getConversation = async (req, res) => {
    const { conversationId } = req.params;
    const page = parseInt(req.query.page) || 1;  // Trang hiện tại
    const limit = parseInt(req.query.limit) || 20;  // Số lượng tin nhắn mỗi trang

    try {
        const skip = (page - 1) * limit;  // Số lượng tin nhắn bỏ qua
        const conversation = await Conversation.findOne({ conversationId });
        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Conversation not found' });
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
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}