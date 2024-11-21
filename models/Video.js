import {Schema} from 'mongoose';
import * as moongose from "mongoose";

const VideoSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    videoUrl: {
        type: String,
        required: true
    },
    moduleId: {
        type: moongose.Schema.Types.ObjectId,
        ref: 'Module',
        required: true
    },
    duration: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
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

export default moongose.model('Video', VideoSchema);