import mongoose from 'mongoose';

const CodespaceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  codespaceId: { type: String, required: true, unique: true },
  codespaceName: { type: String, required: true },
  state: { type: String },
  machine: { type: Object },
  createdAt: { type: Date },
  updatedAt: { type: Date },
  webUrl: { type: String },
  lastUsedAt: { type: Date },
});

export default mongoose.model('Codespace', CodespaceSchema);
