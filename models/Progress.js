import mongoose from "mongoose";
const Schema = mongoose.Schema;
import { Module } from "./Module.js";

// Định nghĩa trọng số cho từng loại module item
const ITEM_WEIGHTS = {
  lecture:3,
  quiz: 2,
  programming: 4,
  supplement: 1
};

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
    completionPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
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

/**
 * Xác định loại module item dựa trên dữ liệu
 * @param {Object} item - Module item cần xác định loại
 * @returns {String} Loại của module item
 */





// Helper function để xác định chính xác loại item
function getItemTypeFromModuleItem(moduleItem) {
    if (!moduleItem) return 'unknown';
    
    if (moduleItem.type) return moduleItem.type;
    if (moduleItem.lecture) return 'lecture';
    if (moduleItem.quiz) return 'quiz';
    if (moduleItem.programming) return 'programming';
    if (moduleItem.supplement) return 'supplement';
    
    return 'unknown';
}



// Post-save hook để cập nhật tiến độ của khóa học
ModuleProgressSchema.post('save', async function() {
    try {
        // Tìm tất cả các module progress của cùng một khóa học
        const moduleProgresses = await ModuleProgress.find({
            userId: this.userId,
            courseId: this.courseId
        }).lean();
        
        if (!moduleProgresses || moduleProgresses.length === 0) return;
        
        // Tính tổng tiến độ khóa học
        const totalModules = moduleProgresses.length;
        const completedModules = moduleProgresses.filter(p => p.status === 'completed').length;
        const sumCompletionPercentage = moduleProgresses.reduce(
            (sum, p) => sum + p.completionPercentage, 0
        );
        
        // Tính phần trăm hoàn thành trung bình
        const courseCompletionPercentage = Math.round(sumCompletionPercentage / totalModules);
        
        // Đánh dấu khóa học là hoàn thành nếu tất cả module đã hoàn thành
        const isCourseCompleted = completedModules === totalModules && totalModules > 0;
        
        
    } catch (error) {
        console.error('Error updating course progress:', error);
    }
});

// Hook để xác thực và chuẩn hóa dữ liệu trước khi lưu
ModuleItemProgressSchema.pre('save', function(next) {
    // Đảm bảo completionPercentage luôn từ 0-100
    if (this.completionPercentage < 0) this.completionPercentage = 0;
    if (this.completionPercentage > 100) this.completionPercentage = 100;
    
    // Đảm bảo nhất quán giữa status và completionPercentage
    if (this.completionPercentage >= 95) {
        this.status = 'completed';
    } else if (this.completionPercentage > 0) {
        this.status = 'in-progress';
    } else {
        this.status = 'not-started';
    }
    
    next();
});

ModuleProgressSchema.pre('save', async function (next) {
    try {
        const module = await Module.findById(this.moduleId)
            .populate('moduleItems')
            .lean();
            
        if (!module || !module.moduleItems || module.moduleItems.length === 0) {
            return next();
        }
        
        // Tạo map từ progress items để tìm kiếm nhanh
        const progressMap = new Map();
        this.moduleItemProgresses.forEach(item => {
            const itemId = typeof item.moduleItemId === 'object' && item.moduleItemId._id
                ? item.moduleItemId._id.toString()
                : item.moduleItemId.toString();
            progressMap.set(itemId, item);
        });
        
        // Các biến tính toán
        let totalWeight = 0;
        let completedWeight = 0;
        
        // Log để debug
        console.log(`Recalculating progress for module ${this.moduleId}: ${module.moduleItems.length} items required`);
        
        // KHÁC BIỆT CHÍNH: duyệt qua TẤT CẢ module items thay vì chỉ duyệt qua progress items
        module.moduleItems.forEach(moduleItem => {
            const itemId = moduleItem._id.toString();
            const itemType = getItemTypeFromModuleItem(moduleItem);
            const weight = ITEM_WEIGHTS[itemType] || 1;
            
            // Cộng vào tổng trọng số
            totalWeight += weight;
            
            // Tìm progress tương ứng nếu có
            const progress = progressMap.get(itemId);
            
            console.log(`Module Item ${itemId} (${itemType}): weight=${weight}, progress=${progress ? 'found' : 'not found'}`);
            
            // Tính toán phần hoàn thành
            if (progress) {
                if (progress.status === 'completed') {
                    completedWeight += weight;
                    console.log(`  - Completed: +${weight}`);
                } else if (progress.completionPercentage > 0) {
                    const partialWeight = (weight * progress.completionPercentage / 100);
                    completedWeight += partialWeight;
                    console.log(`  - In progress: +${partialWeight.toFixed(2)} (${progress.completionPercentage}%)`);
                } else {
                    console.log(`  - Not started: +0`);
                }
            } else {
                console.log(`  - No progress record: +0`);
            }
        });
        
        // Tính toán phần trăm hoàn thành
        if (totalWeight > 0) {
            const newPercentage = Math.round((completedWeight / totalWeight) * 100);
            console.log(`Module completion: ${completedWeight.toFixed(2)}/${totalWeight} = ${newPercentage}%`);
            this.completionPercentage = newPercentage;
            
            // Cập nhật trạng thái
            if (newPercentage >= 100) {
                this.status = 'completed';
                if (!this.completedAt) this.completedAt = new Date();
            } else {
                this.status = newPercentage > 0 ? 'in-progress' : 'not-started';
            }
        }
        
        next();
    } catch (error) {
        console.error('Error in progress pre-save middleware:', error);
        next(error);
    }
});

// Tạo model
const ModuleProgress = mongoose.model('Progresses', ModuleProgressSchema);

export default ModuleProgress;