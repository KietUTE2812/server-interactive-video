import mongoose from "mongoose";
const Schema = mongoose.Schema;
const SubmissionSchema = new Schema({
    problemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProgramProblem',
        unique: false,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
    },
    status: {
        type: String,
        enum: ['Accepted', 'Wrong Answer', 'Partially Accepted', 'Runtime Error', 'Compilation Error'],
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
        type: String,
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

SubmissionSchema.pre('save', function (next) {
    if (this.isModified('status') && this.status === 'Accepted') {
        this.score = 100;
    }
    next();
});
export default mongoose.model('Submission', SubmissionSchema);