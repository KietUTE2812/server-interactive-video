import mongoose from "mongoose";
const Schema = mongoose.Schema;
import { Module } from "./Module.js";

// Định nghĩa trọng số cho từng loại module item
const ITEM_WEIGHTS = {
    lecture: 3,
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
        type: mongoose.Schema.Types.Mixed,
        default: {}
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
ModuleProgressSchema.post('save', async function () {
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
ModuleItemProgressSchema.pre('save', function (next) {
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

// Pre-save hook để xử lý validation của nested documents
ModuleProgressSchema.pre('save', function (next) {
    // Validate và normalize từng moduleItemProgress
    if (this.moduleItemProgresses && this.moduleItemProgresses.length > 0) {
        this.moduleItemProgresses.forEach((item, index) => {
            // Đảm bảo completionPercentage luôn từ 0-100
            if (item.completionPercentage < 0) item.completionPercentage = 0;
            if (item.completionPercentage > 100) item.completionPercentage = 100;

            // Kiểm tra completion percentage chỉ được phép tăng
            if (this.isModified(`moduleItemProgresses.${index}.completionPercentage`)) {
                const originalDoc = this.$__.originalDocument;
                if (originalDoc && originalDoc.moduleItemProgresses && originalDoc.moduleItemProgresses[index]) {
                    const originalCompletion = originalDoc.moduleItemProgresses[index].completionPercentage || 0;
                    const newCompletion = item.completionPercentage;

                    // Nếu giá trị mới nhỏ hơn giá trị cũ, giữ nguyên giá trị cũ
                    if (newCompletion < originalCompletion) {
                        console.log(`⚠️  Preventing completion percentage decrease: ${newCompletion}% → ${originalCompletion}% (kept original)`);
                        item.completionPercentage = originalCompletion;
                    }
                }
            }

            // Đảm bảo nhất quán giữa status và completionPercentage
            if (item.completionPercentage >= 95) {
                item.status = 'completed';
                if (!item.completedAt) item.completedAt = new Date();
            } else if (item.completionPercentage > 0) {
                item.status = 'in-progress';
                if (!item.startedAt) item.startedAt = new Date();
            } else {
                item.status = 'not-started';
            }
        });
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

// Instance method để cập nhật moduleItemProgress một cách an toàn
ModuleProgressSchema.methods.updateModuleItemProgress = function (moduleItemId, updateData) {
    const index = this.moduleItemProgresses.findIndex(
        item => item.moduleItemId.toString() === moduleItemId.toString()
    );

    if (index === -1) {
        throw new Error('Module item progress not found');
    }

    // Cập nhật dữ liệu
    const moduleItemProgress = this.moduleItemProgresses[index];

    // Handle result update safely
    if (updateData.result) {
        const existingResult = moduleItemProgress.result || {};
        moduleItemProgress.result = {
            ...existingResult,
            ...updateData.result
        };
        // Remove result from updateData to avoid double assignment
        const { result, ...otherData } = updateData;
        Object.assign(moduleItemProgress, otherData);
    } else {
        Object.assign(moduleItemProgress, updateData);
    }

    // Đánh dấu array đã được modify
    this.markModified('moduleItemProgresses');
    this.markModified(`moduleItemProgresses.${index}`);
    this.markModified(`moduleItemProgresses.${index}.result`);

    return moduleItemProgress;
};

// Static method để tìm và cập nhật moduleItemProgress
ModuleProgressSchema.statics.updateModuleItemProgressById = async function (userId, moduleItemId, updateData, session = null) {
    const progress = await this.findOne({
        userId: userId,
        "moduleItemProgresses.moduleItemId": moduleItemId,
    }).session(session);

    if (!progress) {
        throw new Error('Progress not found');
    }

    progress.updateModuleItemProgress(moduleItemId, updateData);
    await progress.save({ session });

    return progress;
};

// Debug method để kiểm tra trạng thái của moduleItemProgress
ModuleProgressSchema.methods.debugModuleItemProgress = function (moduleItemId) {
    const moduleItemProgress = this.moduleItemProgresses.find(
        item => item.moduleItemId.toString() === moduleItemId.toString()
    );

    if (!moduleItemProgress) {
        console.log(`❌ Module item progress not found for ID: ${moduleItemId}`);
        return null;
    }

    console.log(`🔍 Module Item Progress Debug - ID: ${moduleItemId}`);
    console.log(`   Status: ${moduleItemProgress.status}`);
    console.log(`   Completion: ${moduleItemProgress.completionPercentage}%`);
    console.log(`   Time Spent: ${moduleItemProgress.timeSpent || 0}s`);
    console.log(`   Attempts: ${moduleItemProgress.attempts || 0}`);
    console.log(`   Started At: ${moduleItemProgress.startedAt || 'Not started'}`);
    console.log(`   Completed At: ${moduleItemProgress.completedAt || 'Not completed'}`);

    if (moduleItemProgress.result?.video) {
        const video = moduleItemProgress.result.video;
        console.log(`   Video Progress:`);
        console.log(`     Watched: ${video.watchedDuration || 0}/${video.totalDuration || 0}`);
        console.log(`     Last Position: ${video.lastPosition || 0}`);
        console.log(`     Last Updated: ${video.lastUpdated || 'Never'}`);
    }

    return moduleItemProgress;
};

// Helper method để kiểm tra và validate completion percentage update
ModuleProgressSchema.methods.canUpdateCompletionPercentage = function (moduleItemId, newPercentage) {
    const moduleItemProgress = this.moduleItemProgresses.find(
        item => item.moduleItemId.toString() === moduleItemId.toString()
    );

    if (!moduleItemProgress) {
        return { canUpdate: false, reason: 'Module item progress not found' };
    }

    const currentPercentage = moduleItemProgress.completionPercentage || 0;

    if (newPercentage <= currentPercentage) {
        return {
            canUpdate: false,
            reason: `New completion (${newPercentage}%) must be greater than current completion (${currentPercentage}%)`,
            currentPercentage,
            newPercentage
        };
    }

    return {
        canUpdate: true,
        currentPercentage,
        newPercentage,
        increase: newPercentage - currentPercentage
    };
};

// Tạo model
const ModuleProgress = mongoose.model('Progresses', ModuleProgressSchema);

export default ModuleProgress;