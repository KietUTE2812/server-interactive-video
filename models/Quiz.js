import mongoose from "mongoose";
const Schema = mongoose.Schema;

// Schema  cho Quiz
const QuizSchema = new Schema({
    moduleItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ModuleItem',
        unique: false,
    },
    totalQuestions: {
        type: Number,
        default: function () {
            return this.questions.length;
        }
    },
    totalPoints: {
        type: Number,
        default: function () {
            return this.questions.reduce((sum, question) => sum + question.points, 0);
        }
    },
    duration: {
        type: Number,
        required: true,
        default: 1200 // 20 minutes in seconds
    },
    passingScore: {
        type: Number,
        required: true,
        default: 70 // percentage
    },
    questions: [{
        orderNumber: {
            type: Number,
            required: true
        },
        content: {
            type: String,
            required: true,
            trim: true
        },
        type: {
            type: String,
            required: true,
            enum: ['multiple-choice', 'true-false', 'single-choice'],
            default: 'single-choice'
        },
        points: {
            type: Number,
            required: true,
            default: 1
        },
        answers: [{
            content: {
                type: String,
                required: true,
                trim: true
            },
            isCorrect: {
                type: Boolean,
                required: true,
                default: false
            }
        }],
        explanation: {
            type: String,
            trim: true
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    autoIndex: false,
});

// Middleware để cập nhật totalQuestions và totalPoints trước khi lưu
QuizSchema.pre('save', function (next) {
    this.totalQuestions = this.questions.length;
    this.totalPoints = this.questions.reduce((sum, question) => sum + question.points, 0);
    next();
});

export default mongoose.model('Quiz', QuizSchema);