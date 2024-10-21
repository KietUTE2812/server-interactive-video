import mongoose from "mongoose";
const Schema = mongoose.Schema;

const PaymentSchema = new Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        enum: ['vnd', 'usd', 'eur'],
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['vnpay', 'zalopay'],
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'success', 'failed'],
        required: true
    },
    paymentId: {
        type: String,
        required: true
    },
    paymentDetail: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model('Payment', PaymentSchema);