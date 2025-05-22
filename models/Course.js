import mongoose from "mongoose";
import { Module } from "./Module.js";
const Schema = mongoose.Schema;

const CourseSchema = new Schema({
    courseId: {
        type: String,
        required: true,
        unique: true,
        maxlenghth: [10, 'Course ID can not be more tham 10 characters']
    },
    title: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        maxlength: [500, 'Title can not be more than 50 characters']
    },
    description: {
        type: String,
        required: true,
        maxlength: [1000, 'Description can not be more than 500 characters']
    },
    instructor: {
        type: mongoose.Schema.Types.ObjectId, // Reference to Users Collection
        ref: 'User',
        required: true
    },
    level: {
        type: String,
        default: 'beginner',
        enum: ['beginner', 'intermediate', 'advanced']
    },
    price: {
        type: Number,
        default: 0,
    },
    modules: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Module' // Reference to Module model
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    isApproved: {
        type: Boolean,
        required: true,
        default: false,
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId, // Reference to Users Collection (admin)
        ref: 'User',
    },
    averageRating: {
        type: Number,
        min: [1, 'Rating must be at least 1'],
        max: [10, 'Rating must can not be more than 10']
    },
    courseReviews: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CourseReview'
    }],
    photo: {
        type: String,
        default: 'https://res.cloudinary.com/dgbp29tck/image/upload/v1729536960/course_b1auye.jpg'
    },
    sumaryVideo: {
        type: String
    },
    enrollmentCount: {
        type: Number,
        default: 0
    },
    tags: [{
        type: String,
        trim: true
    }],
    status: {
        type: String,
        enum: ['draft', 'published', 'unpublished'],
        default: 'draft'
    }

}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
}, { timestamps: true });

// Tạo index để tối ưu hóa truy vấn
CourseSchema.index({ title: 'text', description: 'text' });

// Middleware trước khi lưu để cập nhật updatedAt
CourseSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Virtual để lấy số lượng đánh giá
CourseSchema.virtual('reviewCount', {
    ref: 'Review',
    localField: '_id',
    foreignField: 'course',
    count: true
});

export default mongoose.model('Course', CourseSchema);