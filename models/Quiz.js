import mongoose from "mongoose";
const Schema = mongoose.Schema;

// Schema cho câu trả lời
const AnswerSchema = new Schema({
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
});

// Schema cho câu hỏi
const QuestionSchema = new Schema({
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
        enum: ['multiple-choice', 'true-false', 'only-choice'],
        default: 'only-choice'
    },
    points: {
        type: Number,
        required: true,
        default: 1
    },
    answers: [AnswerSchema],
    explanation: {
        type: String,
        trim: true
    }
});

// Schema chính cho Quiz
const QuizSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: [100, 'Title cannot be more than 100 characters']
    },
    description: {
        type: String,
        trim: true
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
    questions: [QuestionSchema],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Middleware để cập nhật totalQuestions và totalPoints trước khi lưu
QuizSchema.pre('save', function (next) {
    this.totalQuestions = this.questions.length;
    this.totalPoints = this.questions.reduce((sum, question) => sum + question.points, 0);
    next();
});

export default mongoose.model('Quiz', QuizSchema);