import mongoose from "mongoose";
const Schema = mongoose.Schema;
import { Module } from "./Module.js";

// Schema để lưu chi tiết progress của từng loại module item
const ModuleItemProgressSchema = new Schema({
    moduleItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ModuleItem',
        required: true
    },
    status: {
        type: String,
        enum: ['not-started', 'in-progress', 'completed'],
        default: 'not-started'
    },
    // Thời gian bắt đầu làm
    startedAt: {
        type: Date
    },
    // Thời gian hoàn thành
    completedAt: {
        type: Date
    },
    // Số lần thử
    attempts: {
        type: Number,
        default: 0
    },
    // Thời gian dành cho module item này (tính bằng giây)
    timeSpent: {
        type: Number,
        default: 0
    },
    // Lưu kết quả chi tiết tùy theo loại module item
    result: {
        // Cho Quiz
        quiz: {
            score: Number,
            totalQuestions: Number,
            correctAnswers: Number,
            wrongAnswers: Number,
            timeSpent: Number,
            isPassed: Boolean,
            answers: [{
                questionId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Question'
                },
                type: {
                    type: String,
                    enum: ['only-choice', 'multiple-choice', 'true-false']
                },
                explanation: String,
                selectedAnswer: {
                    type: mongoose.Schema.Types.Mixed,
                },
                isCorrect: Boolean,
                timeSpent: Number
            }]
        },
        // Cho Programming
        programming: {
            submissionId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Submission'
            },
            testCasesPassed: Number,
            totalTestCases: Number,
            score: Number,
            code: String,
            language: String,
            compilationError: String,
            executionTime: Number,
            memory: String,
        },
        // Cho Reading
        reading: {
            status: {
                type: String,
                enum: ['not-started', 'in-progress', 'completed'],
                default: 'not-started'
            }
        },
        // Cho Video
        video: {
            watchedDuration: Number,
            totalDuration: Number,
            lastPosition: Number,
            completionPercentage: Number,
            notes: [{
                timestamp: Number,
                content: String,
                createdAt: Date
            }]
        }
    }
}, {
    timestamps: true
});

// Schema chính để lưu progress của module
const ModuleProgressSchema = new Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    moduleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Module',
        required: true
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    status: {
        type: String,
        enum: ['not-started', 'in-progress', 'completed'],
        default: 'not-started'
    },
    completionPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    // Lưu progress của từng module item
    moduleItemProgresses: [ModuleItemProgressSchema],
    // Tổng thời gian học
    totalTimeSpent: {
        type: Number,
        default: 0
    },
    // Điểm trung bình của module (nếu có)
    averageScore: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Index cho việc tìm kiếm
ModuleProgressSchema.index({ userId: 1, moduleId: 1 }, { unique: true });
ModuleProgressSchema.index({ userId: 1, courseId: 1 });

// Middleware để tự động cập nhật completionPercentage
ModuleProgressSchema.pre('save', async function (next) {
    const module = await Module.findById(this.moduleId);
    console.log(this.moduleId)
    if (!module) {
        return next(new Error('Module not found'));
    }
    const totalItems = module.moduleItems.length;
    if (this.moduleItemProgresses && this.moduleItemProgresses.length > 0) {
        const completedItems = this.moduleItemProgresses.filter(
            item => item.status === 'completed'
        ).length;

        this.completionPercentage = Math.round(
            (completedItems / totalItems) * 100
        );

        if (this.completionPercentage === 100) {
            this.status = 'completed';
        } else if (this.completionPercentage > 0) {
            this.status = 'in-progress';
        }

        // Cập nhật tổng thời gian
        this.totalTimeSpent = this.moduleItemProgresses.reduce(
            (total, item) => total + (item.timeSpent || 0),
            0
        );

        // Tính điểm trung bình cho các items có điểm
        const scoredItems = this.moduleItemProgresses.filter(
            item => item.result?.quiz?.score || item.result?.programming?.score
        );

        if (scoredItems.length > 0) {
            this.averageScore = scoredItems.reduce((total, item) => {
                const score = item.result.quiz?.score || item.result.programming?.score || 0;
                return total + score;
            }, 0) / scoredItems.length;
        }
    }
    next();
});

// Tạo model
const ModuleProgress = mongoose.model('Progresses', ModuleProgressSchema);

export default ModuleProgress;