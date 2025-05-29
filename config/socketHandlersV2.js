import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Notification from "../models/Notification.js";
import Group from "../models/Group.js";
export const handleSocketConnection = (io) => {
    const users = new Map(); // User online 
    const userSockets = new Map(); // Save user socket id
    const activeConversations = new Map(); // Cache active conversations

    const MESSAGE_TYPES = {
        TEXT: 'text',
        IMAGE: 'image',
        FILE: 'file'
    };

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.id}`);
        // User loggin
        socket.on('user:login', handleUserLogin);
        // User joins the chat
        socket.on('conversation:join', handleJoinConversation);
        // User leaves the chat
        socket.on('conversation:leave', handleLeaveConversation);
        // User sends a message
        socket.on('conversation:send_message', handleSendMessage);
        // User typing a message
        socket.on('conversation:typing', handleTyping);
        // User stops typing a message
        socket.on('conversation:stop_typing', handleStopTyping);
        // User disconnects
        socket.on('disconnect', handleDisconnect);

        async function handleUserLogin({ userId, fullname, picture, role = 'student' }) {
            console.log(`User ${userId} logged in`);
            if (!userId || !fullname) {
                return socket.emit('error', { message: "Invalid user data" });
            }
            // Find group of user
            const group = await Group.findOne({ users: { $in: [userId] } });
            if (group) {
                socket.join("group:" + group._id);
                console.log(`User ${userId} joined group room ${group._id}`);
            }
            console.log(`User ${userId} logged in`);
            users.set(userId, { fullname, picture, online: true, lastSeen: new Date(), role });
            socket.join("user:" + userId);
            console.log(`User ${userId} joined user room`);
            userSockets.set(socket.id, userId);
        }

        async function handleJoinConversation(conversationId) {
            console.log(`User ${socket.id} joined conversation ${conversationId}`);
            socket.join(conversationId);
            const userId = userSockets.get(socket.id);
            activeConversations.set(conversationId, [...(activeConversations.get(conversationId) || []), userId]);
            // Leave all other rooms
            socket.rooms.forEach(room => {
                if (room !== socket.id && room !== conversationId && room !== "user:" + userId) {
                    socket.leave(room);
                    activeConversations.set(room, (activeConversations.get(room) || []).filter(id => id !== userId));
                }
                });
            // Cập nhật unReadCounts của cuộc hội thoại
            const conversation = await Conversation.findById(conversationId);
            conversation?.unReadCounts.set(userId, 0);
            await conversation.save();
        }

        async function handleLeaveConversation(conversationId) {
            console.log(`User ${socket.id} left conversation ${conversationId}`);
            socket.leave(conversationId);
            const userId = userSockets.get(socket.id);
            const participants = activeConversations.get(conversationId) || [];
            activeConversations.set(conversationId, participants.filter(id => id !== userId));
        }

        async function getReceiverId(conversationId, senderId) {
            // Tùy vào cách lưu trữ hội thoại trong DB, bạn có thể thay đổi logic này
            const conversation = await Conversation.findById(conversationId); // Lấy từ cache hoặc database
            if (!conversation) return null;
            
            return conversation.participants.find(id => id !== senderId); // Trả về ID người nhận
        }

        async function handleSendMessage({ conversationId, content, type = MESSAGE_TYPES.TEXT }) {
            try {
                console.log(`User ${socket.id} sent message in conversation ${conversationId}`);
                
                const senderId = userSockets.get(socket.id);
                const message = new Message({
                    conversationId,
                    senderId,
                    content,
                    type
                });
                (await message.save())
                const new_message = await Message
                    .findById(message._id)
                    .populate('senderId', 'profile')
                    .lean();
                // Cập nhật unreadCounts và lastMessage của cuộc hội thoại
                const conversation = await Conversation.findById(conversationId);
                conversation.lastMessage = message._id;
                conversation.updatedAt = new Date();
                conversation.participants.forEach((userId) => {
                    if (userId.toString() !== senderId.toString()) {
                        conversation.unReadCounts.set(userId.toString(), (conversation?.unreadCounts?.get(userId.toString()) || 0) + 1);
                    }
                });
                await conversation.save();

                // Gửi tin nhắn mới đến tất cả người dùng trong phòng
                io.to(conversationId).emit('conversation:new_message', new_message);
                // Tìm ID người nhận
                const receiverId = await getReceiverId(conversationId, senderId); // Hàm lấy ID người nhận
                const conversationSockets = activeConversations.get(conversationId); // Mảng các participant đang trong phòng
                // Kiểm tra xem người nhận có đang trong phòng hay không
                if (receiverId) {
                    if (!conversationSockets || !conversationSockets.includes(receiverId)) {
                    // Người nhận chưa mở cuộc hội thoại → Gửi thông báo tin nhắn chưa đọc
                        console.log(`User ${receiverId} is offline, sending unread message notification`);
                        io.to("user:" + receiverId).emit('conversation:unread_message', {
                            conversationId,
                            senderId,
                            content: content.substring(0, 30), // Gửi nội dung xem trước
                            type
                        });
                    }
                }

                // Gửi thông báo cho user, Dùng Notification
                const notification = new Notification({
                    user: receiverId,
                    title: "New message from" + ' ' + users.get(senderId).fullname,
                    message: content.substring(0, 30),
                    read: false,
                    link: users.get(receiverId).role === 'student' ? `/learns/${conversation.courseId}/course-inbox` : `/instructor/instructor-chat`,
                    metadata: {
                        conversationId
                    }
                });
                await notification.save();
                console.log(`User ${users.get(receiverId)} is offline, send notification`);
                io.to("user:" + receiverId).emit('notification:new', notification);
            } catch (error) {
                console.error("Error saving message:", error);
                socket.emit('error', { message: "Failed to send message" });
            }
        }

        async function handleTyping(conversationId) {
            io.to(conversationId).emit('conversation:typing', {
                conversationId,
                userId: userSockets.get(socket.id)
            });
        }
        async function handleStopTyping(conversationId) {
            io.to(conversationId).emit('conversation:stop_typing', {
                conversationId,
                userId: userSockets.get(socket.id)
            });
        }

        async function handleDisconnect() {
            console.log(`User ${socket.id} disconnected`);
            const userId = userSockets.get(socket.id); // Lấy userId trước
            userSockets.delete(socket.id);
            if (userId) {
                users.delete(userId);
            }
            socket.leaveAll();
            socket.disconnect();
        }
        
    });
}

