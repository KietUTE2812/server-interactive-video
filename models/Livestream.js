import mongoose from "mongoose";
const Schema = mongoose.Schema;

const LivestreamSchema = new Schema({
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    title: {
        type: String,
        required: true,
        maxlength: 100
    },
    description: {
        type: String,
        maxlength: 500
    },
    instructor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['upcoming', 'live', 'finished'],
        default: 'upcoming'
    },
    startTime: {
        type: Date,
        required: function () {
            return this.status !== 'upcoming'
        }
    },
    endTime: {
        type: Date
    },
    isLive: {
        type: Boolean,
        default: false
    },
    youtubeLink: {
        type: String,
        default: null
    },
    replayAvailable: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Middleware cập nhật thời gian sửa đổi
LivestreamSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

export default mongoose.model('Livestream', LivestreamSchema);
