// import Conversation from "../models/Conversation.js";
// import Message from "../models/Message.js";
// import Notification from "../models/Notification.js";

// export const handleSocketConnection = (io) => {
//     const users = new Map(); // User online
//     const userSockets = new Map();
//     const activeConversations = new Map();

//     const MESSAGE_TYPES = {
//         TEXT: 'text',
//         IMAGE: 'image',
//         FILE: 'file'
//     };
//     const getConversationsByUserId = async (userId) => {
//         try{
//             const conversations = await Conversation.find({
//                 participants: { $in: [userId]},
//             }).populate('participants', 'profile').lean();
//             if (conversations) {
//                 for (const conversation of conversations) {
//                     // // Get 50 last messages
//                     // const messages = await Message.find({ conversationId: conversation._id })
//                     //     .sort({ createdAt: -1 })
//                     //     .limit(50)
//                     //     .populate('reader', 'profile') // Populate thông tin người gửi nếu cần
//                     //     .lean();
//                     //
//                     // conversation.messages = messages.reverse();
//                     const lastMessage = await Message.findOne({conversationId: conversation._id}).sort({createdAt: -1}).lean();
//                     const unreadCount = await Message.countDocuments({conversationId: conversation._id, readers: {$nin: [userId]}});
//                     conversation.lastMessage = lastMessage;
//                     conversation.unreadCount = unreadCount;
//                     conversation.joining = [];
//                     activeConversations.set(conversation._id.toString(), conversation);
//                 }
//                 return conversations;
//             }
//             return [];
//         }
//         catch(error){
//             throw error;
//         }
//     }
    
//     io.on('connection', (socket) => {
//         console.log(`User connected: ${socket.id}`);
//         socket.on('user:login', handleUserLogin);// Lấy toàn bộ conversation của user, bao gồm lastMessage và unReadCount
//         socket.on('conversation:join', handleConversationJoin);// Lấy toàn bộ tin nhắn của conversation, chuyển unreadCount = 0 và đọc tất cả tin nhắn
//         socket.on('message:send', handleMessageSend);// Lưu message vào database, kiểm tra nếu đang join vào conver thì đã đọc, còn lại chưa đọc
//         socket.on('conversation:out', handleConversationOut);
//         socket.on('conversation:create', handleConversationCreate)
//         socket.on('conversation:check', handleConversationCheck)
//         socket.on('disconnect', handleUserDisconnect); // disconection
//         socket.on('conversation:recall', async ({userId}) => {
//             console.log('recall:', userId);
//             const conversations = await getConversationsByUserId(userId);
//             io.to(`user:${userId}`).emit('conversation:list', conversations);
//         })
        
//         async function handleUserLogin({ userId, username, picture }) {
//             const userExist = userSockets.get(userId);
//             console.log('userExist:', userExist);
//             if (userExist) {
//                 userSockets.set(userId, socket.id);
//                 socket.userId = userId;
//                 return
//             }
            
//             const user = {
//                 id: userId,
//                 username,
//                 picture,
//                 online: true,
//                 lastSeen: new Date()
//             }; 
            
//             users.set(userId, user);
//             userSockets.set(userId, socket.id);
//             socket.userId = userId;
//             socket.join(`user:${userId}`);
            
//             const conversations = await getConversationsByUserId(userId);
//             io.to(`user:${userId}`).emit('conversation:list', conversations);
//             console.log('User logged in:', userId);

//             io.emit('users:online', Array.from(users.values()));
//         }

//         async function handleConversationJoin({ conversationId }) {
//             try {
//                 let conversation = activeConversations.get(conversationId);
//                 console.log('conversation:', conversationId);
//                 if(!conversation) {
//                     const data = await Conversation.findById(conversationId).populate('participants', 'profile').lean();
//                     conversation = {...data, messages: []};
//                     activeConversations.set(conversationId, conversation);
//                 }
//                 if(conversation?.joining === undefined)
//                     conversation = {...conversation, joining: []};
//                 conversation.joining.push(socket.userId)
//                 console.log('conversation:', conversation.joining);
 
//                 if (!conversation.participants.some(p => p._id.toString() === socket.userId)) {
//                     return socket.emit('error', { message: 'Not authorized to join this conversation' });
//                 }
//                 socket.join(conversationId);
//                 if(conversation.unreadCount > 0){
//                     conversation.unreadCount = 0;
//                     await Message.updateMany(
//                         {
//                             conversationId: conversation._id,
//                             readers: { $nin: [socket.userId] }
//                         },
//                         {
//                             $push: {
//                                 readers: socket.userId,
//                             }
//                         }
//                     )
//                     socket.emit('conversation:update', conversation);
//                 }
                
//                 // Get 50 last messages
//                 const messages = await Message.find({ conversationId: conversation._id })
//                     .sort({ createdAt: -1 })
//                     .limit(50)
//                     .lean();

//                 socket.emit('message:list', messages.reverse());
//             } catch (error) {
//                 console.error('Error joining conversation:', error);
//                 socket.emit('error', { message: 'Failed to join conversation' });
//             }
//         }
        
//         async function handleConversationOut({ conversationId }) {
//             try {
//                 const conversation = activeConversations.get(conversationId);
//                 if (!conversation) return;
//                 const user = users.get(socket.userId);
//                 if (!user) return;
//                 const index = conversation.joining.indexOf(socket.userId);
//                 if (index === -1) return;
//                 conversation.joining.splice(index, 1);
//             }
//             catch(error){
//                 console.error('Error out conversation:', error);
//             }
//         }
        
//         async function handleConversationCreate({ studentId, instructorId, courseId, type = 'direct', name = '', avatar = '', admin = [] }) {
//             const participants = [studentId, instructorId];
//             try {
//                 const conversation = {
//                     participants,
//                     conversationId: Date.now().toString(),
//                     type,
//                     courseId,
//                     metadata: {
//                         name,
//                         avatar,
//                         admin,
//                     },
//                     lastMessage: null,
//                     unreadCount: 0,
//                     joining: [],
//                 };
//                 const existsConversation = await Conversation.findOne({participants: {$all: participants}, courseId: courseId});
//                 if(existsConversation){
//                     return;
//                 }
//                 console.log('create conversation:', studentId, instructorId, courseId);
//                 const newCon = await Conversation.create(conversation)
//                 activeConversations.set(newCon._id, conversation);
//                 conversation.participants.forEach(participant => {
//                     io.to(`user:${participant._id}`).emit('conversation:new', newCon);
//                 })
//             }
//             catch(error){ 
//                 console.error('Error create conversation:', error);
//             }
//         }
//         async function handleConversationCheck({ instructorId, studentId, courseId }) {
//             console.log('check conversation:', instructorId, studentId, courseId);
//             socket.join(`user:${studentId}`);
//             const participants = [instructorId, studentId];
//             try {
//                 const conversation = await Conversation.findOne({participants: {$all: participants}, courseId: courseId});
//                 if(conversation){
//                     io.to(`user:${studentId}`).emit('conversation:checked', {
//                         success: true,
//                         conversationId: conversation._id
//                     });
//                     console.log('conversation:', conversation);
//                 }
//                 else
//                     {
//                         const newCon = await Conversation.create({
//                             participants,
//                             conversationId: Date.now().toString(),
//                             type: 'direct',
//                             courseId,
//                             metadata: {
//                                 name: '',
//                                 avatar: '',
//                                 admin: [],
//                             },
//                             lastMessage: null,
//                             unreadCount: 0,
//                             joining: [],
//                         });
//                         activeConversations.set(newCon._id, newCon);
//                         io.to(`user:${studentId}`).emit('conversation:checked', {
//                             success: true,
//                             conversationId: newCon._id
//                         });
//                         console.log('Create new conversation:', newCon.conversationId);
//                     }
//             } 
//             catch(error){
//                 io.to(`user:${studentId}`).emit('conversation:checked', {
//                     success: false
//                 });
//                 console.error('Error check conversation:', error);
//             }
//         }
//         async function handleMessageSend({ conversationId, content, type = MESSAGE_TYPES.TEXT }) {
//             let conversation = activeConversations.get(conversationId);
//             if (!conversation) return;
//             const message = {
//                 messageId: Date.now().toString(),
//                 conversationId,
//                 senderId: socket.userId,
//                 content,
//                 type,
//                 createdAt: new Date(),
//                 readers: conversation.joining,
//                 status: 'sent',
//             };
//             if(conversation.messages === undefined)
//                 conversation = {...conversation, messages: []};
//             conversation.messages.push(message);
//             conversation.lastMessage = message;
//             conversation.unreadCount += 1;
            
//             await Message.create(message)

//             const notification = await Notification.create({
//                 title: 'New message from ' + users.get(socket.userId).username,
//                 message: content,
//                 user: conversation.participants.filter(p => p._id.toString() !== socket.userId)[0]._id,
//                 link: `/chat`,
//                 metadata: {
//                     conversationId,
//                 }
//             })

//             io.to(`user:${notification.user}`).emit('notification:new', notification);
            
//             io.to(conversationId).emit('message:new', { message });
//             // Gửi cập nhật đến các user không có trong danh sách `joining`
//             conversation.participants.forEach(participant => {
//                 if (!conversation.joining.includes(participant._id.toString())) {
//                     io.to(`user:${participant._id}`).emit('conversation:update', conversation);
//                 }
//             });
            
//         }
//         const saveMessages = async () => {
//             try {
//                 const savePromises = [];

//                 for (const [conversationId, conversation] of activeConversations) {
//                     const unsavedMessages = conversation.messages.filter(msg =>
//                         !msg.savedToDB
//                     );

//                     if (unsavedMessages.length > 0) {
//                         const savePromise = Message.insertMany(
//                             unsavedMessages.map(msg => ({
//                                 ...msg,
//                                 conversationId
//                             }))
//                         ).then(() => {
//                             unsavedMessages.forEach(msg => msg.savedToDB = true);
//                         });

//                         savePromises.push(savePromise);
//                     }
//                 }

//                 await Promise.all(savePromises);
//             } catch (error) {
//                 console.error('Error saving messages on disconnect:', error);
//             }
//         }
//         socket.on('video-call:join', ({ conversationId, userId }) => {
//             socket.join(conversationId);
//             socket.userId = userId;
//             console.log(`User ${userId} joined video call: ${conversationId}`);
//             socket.to(conversationId).emit('video-call:user-joined', { userId });
//         });

//         socket.on('video-call:offer', ({ conversationId, offer }) => {
//             console.log(`User ${socket.userId} sent offer to user`);
//             socket.to(conversationId).emit('video-call:offer', { conversationId, offer });
//         }); 

//         socket.on('video-call:answer', ({ conversationId, answer }) => {
//             console.log(`User ${socket.userId} sent answer to user`);
//             socket.to(conversationId).emit('video-call:answer', { answer }); 
//         });

//         socket.on('video-call:ice-candidate', ({ conversationId, candidate }) => {
//             socket.to(conversationId).emit('video-call:ice-candidate', { candidate }); 
//         }); 
//         socket.on('video-call:screen-share', ({ isScreenSharing, conversationId }) => {
//             socket.to(conversationId).emit('video-call:screen-share', { isScreenSharing });
//         })
//         socket.on('video-call:leave', ({ conversationId, userId }) => {
//             console.log(`User ${userId} left video call: ${conversationId}`);
//             socket.to(conversationId).emit('video-call:user-left', { userId });
//             socket.leave(conversationId);
//         });
//         async function handleUserDisconnect() { 
//             console.log('User disconnected:', socket.id);
//             const userId = socket.userId;
//             const user = users.get(userId);

//             if (user) {
//                 user.online = false;
//                 user.lastSeen = new Date();
//                 userSockets.delete(userId);
//                 io.emit('users:online', Array.from(users.values()));

//             }
//         }
//     });
// };
