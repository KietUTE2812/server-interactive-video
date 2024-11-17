import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const ConversationSchema = new Schema({
    conversationId: {
       type: String,
       required: true,
       unique: true
    },
    type: {
       type: String,
       enum: ['direct', 'group'],
       required: true
    },
    participants: {
       type: [String], // Array of user IDs
       ref: 'User',
       required: true
    },
    createdAt: {
       type: Date,
       default: Date.now
    },
    updatedAt: {
       type: Date,
       default: Date.now
    },
    metadata: {
       name: {
          type: String,
          default: ''  // Tên nhóm (nếu là nhóm)
       },
       avatar: {
          type: String,
          default: ''  // Avatar nhóm (nếu là nhóm)
       },
       admins: {
          type: [String], // Array of user IDs who are admins
          default: []
       }
    }
 });
 
 const Conversation = mongoose.model('Conversation', ConversationSchema);
 export default Conversation;