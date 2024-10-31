import mongoose from "mongoose";
const Schema = mongoose.Schema;

// Schema cho submission (đã cập nhật)
const SubmissionSchema = new Schema({
    problemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProgrammingProblem',
        required: true
    },
    status: {
        type: String,
        enum: ['Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Runtime Error', 'Compilation Error'],
        required: true
    },
    language: {
        type: String,
        required: true
    },
    runtime: {
        type: Number,
        min: 0
    },
    memory: {
        type: Number,
        min: 0
    },
    src: {
        type: String,
        required: true
    },
    score: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Schema cho testcase
const TestcaseSchema = new Schema({
    problemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProgrammingProblem',
        required: true
    },
    input: {
        type: String,
        required: true
    },
    expectedOutput: {
        type: String,
        required: true
    },
    executeTimeLimit: {
        type: Number,
        required: true,
        default: 1000 // milliseconds
    },
    isHidden: {
        type: Boolean,
        default: false
    },
    weight: {
        type: Number,
        default: 1
    }
});

// Schema cho Programming Problem 
const ProgramProblemSchema = new Schema({
    problemId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        maxlength: [10, 'Problem ID cannot be more than 10 characters']
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: [100, 'Problem title cannot be more than 100 characters']
    },
    description: {
        type: String,
        required: true,
        maxlength: [5000, 'Description cannot be more than 5000 characters']
    },
    difficulty: {
        type: String,
        enum: ['Easy', 'Medium', 'Hard'],
        required: true
    },
    tags: [{
        type: String,
        trim: true
    }],
    constraints: {
        type: String
    },
    inputFormat: {
        type: String
    },
    outputFormat: {
        type: String
    },
    sampleInput: {
        type: String
    },
    sampleOutput: {
        type: String
    },
    explanation: {
        type: String
    },
    editorial: {
        type: String
    },
    submissions: [SubmissionSchema],
    testcases: [TestcaseSchema],
    acceptedCount: {
        type: Number,
        default: 0
    },
    totalSubmissions: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    baseScore: {
        type: Number,
        required: true,
        default: 100
    },
    timeBonus: {
        type: Number,
        default: 0
    },
    memoryBonus: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Hàm tính điểm
ProgramProblemSchema.methods.calculateScore = function (submission) {
    let score = this.baseScore;

    // Điều chỉnh điểm dựa trên độ khó
    const difficultyMultiplier = {
        'Easy': 1,
        'Medium': 1.5,
        'Hard': 2
    };
    score *= difficultyMultiplier[this.difficulty];

    // Thêm điểm thưởng cho thời gian thực thi tốt
    if (submission.runtime < this.testcases[0].executeTimeLimit / 2) {
        score += this.timeBonus;
    }

    // Thêm điểm thưởng cho sử dụng bộ nhớ hiệu quả (giả sử có một ngưỡng)
    const memoryThreshold = 1000000; // 1MB
    if (submission.memory < memoryThreshold) {
        score += this.memoryBonus;
    }

    // Giảm điểm cho các lần nộp bài không thành công trước đó
    // const previousSubmissions = this.submissions.filter(sub => sub.userId.equals(submission.userId));
    // const failedSubmissions = previousSubmissions.filter(sub => sub.status !== 'Accepted').length;
    // score -= failedSubmissions * 5; // Giảm 5 điểm cho mỗi lần nộp bài không thành công

    // Đảm bảo điểm không âm
    return Math.max(score, 0);
};

// Middleware để cập nhật acceptedCount, totalSubmissions và tính điểm trước khi lưu
ProgramProblemSchema.pre('save', function (next) {
    if (this.isModified('submissions')) {
        this.totalSubmissions = this.submissions.length;
        this.acceptedCount = this.submissions.filter(sub => sub.status === 'Accepted').length;

        // Tính điểm cho submission mới nhất nếu nó được chấp nhận
        const latestSubmission = this.submissions[this.submissions.length - 1];
        if (latestSubmission.status === 'Accepted') {
            latestSubmission.score = this.calculateScore(latestSubmission);
        }
    }
    next();
});

export default mongoose.model('ProgramProblem', ProgramProblemSchema);