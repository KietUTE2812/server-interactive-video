import mongoose from "mongoose";
const Schema = mongoose.Schema;


const ModuleItemSchema = new Schema({
    module: {
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
            default: ''
        },
        size: {
            type: Number,
            default: 0,
        },
        fileName: {
            type: String,
            default: ''
        },
        file: {
            type: String,
            default: ''
        }
    },
    assignment:
        [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Assignment'
        }],
    quiz:
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz'
    },
    programming: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Programming'
    }



});

const ModuleItem = mongoose.model('ModuleItem', ModuleItemSchema);

const ModuleSchema = new Schema({
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    index: {
        type: String,
        required: true,
        validate: {
            validator: function (v) {

                return !isNaN(parseInt(v));
            },
            message: props => `${props.value} is not a valid index number!`
        }

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
        ref: 'ModuleItem'
    }]
});
ModuleSchema.pre('save', function (next) {
    if (this.index && typeof this.index === 'number') {
        this.index = this.index.toString();
    }
    next();
});
const Module = mongoose.model('Module', ModuleSchema);

export { Module, ModuleItem };