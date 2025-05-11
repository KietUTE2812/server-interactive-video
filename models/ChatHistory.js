import mongoose from 'mongoose';

const ChatMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'bot'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const ChatHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  messages: { type: [ChatMessageSchema], default: [] },
}, {
  timestamps: true // createdAt, updatedAt
});

const ChatHistory = mongoose.model('ChatHistory', ChatHistorySchema);
export default ChatHistory; 