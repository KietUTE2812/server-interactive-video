import mongoose from "mongoose";
const Schema = mongoose.Schema;

const ModuleItemSchema = new Schema({
    module: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Module',
        required: true,
    },
    title: {
        type: String,
        required: true,
        unique: false,
    },
    description: {
        type: String,
    },
    type: {
        type: String,
        required: true,
        enum: ['supplement', 'lecture', 'quiz', 'programming'],
    },
    contentType: {
        type: String,
        required: true,
        enum: ['Reading', 'Video', 'Practice Quiz', 'Programming Assignment'],
    },
    icon: {
        type: String,
        required: true,
        enum: ['read', 'video', 'quiz', 'code'],
    },
    isGrade: {
        type: Boolean,
        default: false,
    },
    video: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Video',
    },
    reading: {
        type: String,
    },
    quiz: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz',
    },
    programming: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'ProgramProblem',
    },
    assignment: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Assignment',
    }],
}, { autoIndex: false }); // Disable auto indexing


const VideoSchema = new Schema({
    file: {
        type: String,
    },
    duration: {
        type: Number,
    },
    questions: [
        {
            index: {
                type: Number
            },
            questionType: {
                type: String,
                enum: ['multipleChoice', 'trueFalse', 'onlyChoice'],
                default: 'onlyChoice'
            },
            question: {
                type: String
            },
            startTime: {
                type: Number,
                default: 30
            },
            answers: [{
                content: {
                    type: String,
                    trim: true
                },
                isCorrect: {
                    type: Boolean,
                    default: false
                }
            }]
        }
    ]
}, {
    timestamps: true,
    autoIndex: false // Disable auto indexing
});

const ModuleSchema = new Schema({
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    index: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
    },
    moduleItems: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ModuleItem',
    }]
}, { autoIndex: false }); // Disable auto indexing

// Create models
const ModuleItem = mongoose.model('ModuleItem', ModuleItemSchema);
const Video = mongoose.model('Video', VideoSchema);
const Module = mongoose.model('Module', ModuleSchema);

export { Module, ModuleItem, Video };