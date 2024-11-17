import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
    fileName: {
        type: String,
        required: true
    },
    originalName: {
        type: String,
        required: true
    },
    fileType: {
        type: String,
        enum: ['pdf', 'video'],
        required: true
    },
    contentType: {
        type: String,
        required: true
    },
    fileSize: {
        type: Number,
        required: true
    },
    data: {
        type: Buffer,
        required: function () { return this.fileType === 'pdf'; }
    },
    uploadDate: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

export default mongoose.model('File', fileSchema);