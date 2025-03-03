import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
    messageId: {
       type: String,
       required: true,
       unique: true,
       default: () => `MSG-${Date.now()}-${Math.floor(Math.random() * 10000)}` // Unique message ID
    },
    conversationId: {
       type: String,
       required: true,
    },
    senderId: {
       type: Schema.Types.ObjectId,
       ref: 'User',
       required: true
    },
    content: {
       type: String,
       required: true
    },
    type: {
       type: String,
       enum: ['text', 'image', 'file'],
       default: 'text'
    },
    createdAt: {
       type: Date,
       default: Date.now
    },
    readers: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    status: {
       type: String,
       enum: ['sent', 'received', 'read'],
       default: 'sent'
    },
 });
 
 const Message = mongoose.model('Message', MessageSchema);
 export default Message;