import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 10
    },
    comment: {
        type: String,
        required: true,
        maxlength: 500
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

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

const Review = mongoose.model('Review', reviewSchema);
export default Review;