import mongoose from "mongoose";

const Schema = mongoose.Schema;
const reviewSchema = new Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    comment: {
        type: String,
        required: true,
        maxlength: 5000
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    status: {
        type: String,
        enum: ['deleted', 'active'],
        default: 'active'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})
reviewSchema.post('save', async function () {
    const CourseModel = mongoose.model('Course');

    const courseId = this.course;

    const stats = await this.constructor.aggregate([
        {
            $match: { course: courseId }
        },
        {
            $group: {
                _id: '$course',
                averageRating: { $avg: '$rating' },
                numReviews: { $sum: 1 }
            }
        }
    ]);

    if (stats.length > 0) {
        await CourseModel.findByIdAndUpdate(courseId, {
            averageRating: stats[0].averageRating,
            $push: { courseReviews: this._id }
        });
    } else {
        await CourseModel.findByIdAndUpdate(courseId, {
            averageRating: 0,
            $push: { courseReviews: this._id }
        });
    }
});

export default mongoose.model('Review', reviewSchema);