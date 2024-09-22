import mongoose from "mongoose";
const Schema = mongoose.Schema;

const UserSchema = new Schema({

    userId: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        unique: true,
        required: true
    },
    email: {
        type: String,
        unique: true,
        required: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['instructor', 'student', 'admin'],
        default: 'student'
    },
    profile: {
        fullname: {
            type: String,
            default: ''
        },
        picture: {
            type: String,
            default: ''
        },
        bio: {
            type: String,
            default: ''
        }
    },
    enrolled_courses: [{
        type: Schema.Types.ObjectId,
        ref: 'Course'
    }],
    roadmap: [{
        type: Schema.Types.ObjectId,
        ref: 'Course'
    }],
    progress: [{
        course: {
            type: Schema.Types.ObjectId,
            ref: 'Course'
        },
        completed: {
            type: Boolean,
            default: false
        },
        total_lectures: {
            type: Number,
            default: 0
        },
        completed_lectures: {
            type: Number,
            default: 0
        },
        last_viewed: {
            type: Date,
            default: Date.now
        }
    }],
    status: {
        type: String,
        enum: ['active', 'removed'],
        default: 'active'
    }

}, {
    timestamps: true
}
);

//compile the schema into a model
export default mongoose.model("User", UserSchema)