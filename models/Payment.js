import mongoose from "mongoose";
const Schema = mongoose.Schema;

const PaymentSchema = new Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true,
        index: true
    },
    currency: {
        type: String,
        enum: ['vnd', 'usd', 'eur'],
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['vnpay', 'zalopay'],
        required: true,
        index: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'success', 'failed'],
        required: true,
        index: true
    },
    paymentId: {
        type: String,
        required: true,
        unique: true
    },
    orderId: {
        type: String,
        required: true
    },
    orderInfo: {
        type: String,
        default: 'Thanh toán học phí'
    },
    transactionNo: {
        type: String,
        sparse: true
    },
    paymentDetail: {
        type: Object,
        default: {}
    },
    refundStatus: {
        type: String,
        enum: ['none', 'requested', 'processing', 'completed', 'rejected'],
        default: 'none'
    },
    refundAmount: {
        type: Number,
        default: 0
    },
    refundDate: {
        type: Date
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: { createdAt: false, updatedAt: true }
});

// Compound indexes for faster analytics queries
PaymentSchema.index({ paymentStatus: 1, createdAt: 1 });
PaymentSchema.index({ userId: 1, paymentStatus: 1 });
PaymentSchema.index({ courseId: 1, paymentStatus: 1 });
PaymentSchema.index({ paymentMethod: 1, paymentStatus: 1 });

// Methods for payment analytics
PaymentSchema.statics.getSuccessRate = async function(startDate, endDate) {
    const stats = await this.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                success: { $sum: { $cond: [{ $eq: ["$paymentStatus", "success"] }, 1, 0] } }
            }
        },
        {
            $project: {
                _id: 0,
                total: 1,
                success: 1,
                rate: { $divide: ["$success", "$total"] }
            }
        }
    ]);
    
    return stats.length > 0 ? stats[0] : { total: 0, success: 0, rate: 0 };
};

// Pre-save middleware to update the updatedAt timestamp
PaymentSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

export default mongoose.model('Payment', PaymentSchema);