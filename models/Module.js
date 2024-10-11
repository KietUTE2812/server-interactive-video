import mongoose from "mongoose";
const Schema = mongoose.Schema;


const ModuleItemSchema = new Schema({
    moduleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Module',
        required: true,
        unique: true
    },
    title: {
        type: String,
        required: true,
        unique: true
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
    status: {
        type: String,
        required: true,
        enum: ['completed', 'not-completed'],
        default: 'not-completed'
    },
    isGrade: {
        type: Boolean,
        default: false,
    },
    references: {
        title: {
            type: String,
        },
        link: {
            type: String,
        }
    },
    assignment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Assignment'
    }

});

const ModuleItem = mongoose.model('ModuleItem', ModuleItemSchema);

const ModuleSchema = new Schema({
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true,
        enum: ['completed', 'not-completed'],
        default: 'not-completed'
    },
    moduleItems: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ModuleItem'
    }]
});

const Module = mongoose.model('Module', ModuleSchema);

export { Module, ModuleItem };