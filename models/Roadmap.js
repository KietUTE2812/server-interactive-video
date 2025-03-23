import mongoose from 'mongoose';
const Schema = mongoose.Schema;

// Schema cho các câu hỏi trong bài test
const TestQuestionSchema = new Schema({
    question: {
        type: String,
        required: true,
        trim: true
    },
    options: {
        type: [{
            _id: false,
            text: {
                type: String,
                required: true,
                trim: true
            },
            isCorrect: {
                type: Boolean,
                default: false
            }
        }],
    },
    type: {
        type: String,
        enum: ['single-choice','multiple-choice'], // True/false will be treated as single-choice 
        default: 'multiple-choice'
    },
    explanation: {
        type: String,
        trim: true,
        default: ''
    },
    points: {
        type: Number,
        default: 1,
        min: 0
    }
}, { _id: true });

// Schema cho bài test của mỗi item
const RoadmapItemTestSchema = new Schema({
    itemId: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    questions: [TestQuestionSchema],
    passingScore: {
        type: Number,
        required: true,
        min: 0
    },
    timeLimit: {
        type: Number, // Thời gian giới hạn tính bằng phút
        min: 0
    },
    status: {
        type: String,
        enum: ['active', 'draft'],
        default: 'active'
    }
}, {
    timestamps: true
});

const UserTestResultAttemptSchema = new Schema({
    attemptNumber: {
        type: Number,
        default: 1
    },
    score: {
        type: Number,
        required: true
    },
    passed: {
        type: Boolean,
        required: true
    },
    answers: [{
        questionId: {
            type: Schema.Types.ObjectId,
            required: true
        },
        selectedOptions: [{
            type: Number, // Index của option trong mảng options
        }],
        isCorrect: {
            type: Boolean
        }
    }],
    completedAt: {
        type: Date,
        default: Date.now
    },
    timeTaken: {
        type: Number,
        required: true
    }
});
// Schema cho kết quả làm bài test của người dùng
const UserTestResultSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    testId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'RoadmapItemTest'
    },
    passed: {
        type: Boolean,
        required: true
    },
    attempts: [UserTestResultAttemptSchema],
}, {
    timestamps: true
});


// Schema for individual items in a phase
const RoadmapItemSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    tags: [String],
    description: {
        type: String,
        required: true,
        trim: true
    },
    completed: {
        type: Boolean,
        default: false
    },
    order: {
        type: Number,
        required: true
    },
    test: {
        type: Schema.Types.ObjectId,
        ref: 'RoadmapItemTest',
        default: null,
        required: false
    },
    userTestResults: {
        type: Schema.Types.ObjectId,
        ref: 'UserTestResult',
        default: null,
        required: false
    },
}, { _id: true });

// Schema for phases
const PhaseSchema = new Schema({
    phase: {
        type: Number,
        required: true,
        min: 1
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    duration: {
        type: Number,
        required: true,
        min: 0
    },
    items: [RoadmapItemSchema],
    status: {
        type: String,
        enum: ['not-started', 'in-progress', 'completed'],
        default: 'not-started'
    },
    startDate: {
        type: Date
    },
    endDate: {
        type: Date
    }
}, { _id: true });

// Main Roadmap Schema
const RoadmapSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    phases: [PhaseSchema],
    creator: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    visibility: {
        type: String,
        enum: ['private', 'public', 'shared'],
        default: 'private'
    },
    tags: [{
        type: String,
        trim: true
    }],
    difficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'beginner'
    },
    estimatedTimeInMonths: {
        type: Number,
        min: 0
    },
    category: {
        type: String,
        required: true,
        trim: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for total progress
RoadmapSchema.virtual('progress').get(function() {
    if (!this.phases.length) return 0;

    const completedItems = this.phases.reduce((acc, phase) => {
        return acc + phase.items.filter(item => item.completed).length;
    }, 0);

    const totalItems = this.phases.reduce((acc, phase) => {
        return acc + phase.items.length;
    }, 0);

    return totalItems ? Math.round((completedItems / totalItems) * 100) : 0;
});

// Pre-save middleware to calculate estimatedTimeInMonths
RoadmapSchema.pre('save', function(next) {
    if (this.phases.length) {
        this.estimatedTimeInMonths = this.phases.reduce((acc, phase) => acc + phase.duration, 0);
    }
    next();
});

// Update Phase when all item is marked as completed
RoadmapSchema.pre('save', function(next) {
    this.phases.forEach(phase => {
        if (phase.items.length && phase.items.every(item => item.completed)) {
            phase.status = 'completed';
            phase.endDate = Date.now();
        }
    });
    next();
});


const Roadmap = mongoose.model('Roadmap', RoadmapSchema);
const RoadmapItemTest = mongoose.model('RoadmapItemTest', RoadmapItemTestSchema);
const UserTestResult = mongoose.model('UserTestResult', UserTestResultSchema);

export default {Roadmap, RoadmapItemTest, UserTestResult};