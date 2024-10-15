import mongoose from "mongoose";
const Schema = mongoose.Schema;

const AssignmentSchema = new Schema({
    courseId: {
        type: Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['passed', 'overdue', 'pending'],
        default: 'pending'
    },
    due: {
        type: Date,
    },
    weight: { // Trọng số của item này trong tổng điểm.
        type: Number,
        min: 0,
        max: 100,
        required: true
    },
    icon: {
        type: String,
        required: true
    },
    grade: {
        type: Number,
        min: 0,
        max: 100,
        default: null
    },
    isPassed: {
        type: Boolean,
        default: false,
    },
    assignmentType: {
        type: String,
        enum: ['quiz', 'programming'],
        required: true
    },
    quiz: {
        type: Schema.Types.ObjectId,
        ref: 'Quiz'
    },
    programmingProblem: {
        type: Schema.Types.ObjectId,
        ref: 'ProgrammingProblem'
    }

});

AssignmentSchema.methods.getScore = async function () {
    if (this.assignmentType === 'quiz') {
        await this.populate('quiz');
        if (this.quiz) {
            // Assuming the quiz score is stored in the grade field
            return this.grade;
        }
    } else if (this.assignmentType === 'programming') {
        await this.populate('programmingProblem', 'submissions');
        if (this.programmingProblem) {
            // For programming problems, we need to find the latest accepted submission
            const latestAcceptedSubmission = this.programmingProblem.submissions
                .filter(sub => sub.status === 'Accepted')
                .sort((a, b) => b.createdAt - a.createdAt)[0];

            return latestAcceptedSubmission ? latestAcceptedSubmission.score : 0;
        }
    }
    return 0; // Return 0 if no score is found
};

export default mongoose.model('Assignment', AssignmentSchema);