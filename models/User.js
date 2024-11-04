import mongoose from "mongoose";
const Schema = mongoose.Schema;
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const UserSchema = new Schema({

    userId: {
        type: String,
        required: true,
        unique: true
    },
    googleId: {
        type: String
    },
    facebookId: {
        type: String
    },
    githubId: {
        type: String
    },
    username: {
        type: String,
        unique: true,
        required: true
    },
    refreshToken: {
        type: String
    },
    verifyCode: { // mã xác thực email
        type: Number
    },
    verifyCodeExpired: {
        type: Date
    },
    verifyForgotPassword: { // mã xác thực quên mật khẩu
        type: Number
    },
    verifyForgotPasswordExpired: {
        type: Date
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
        required: function () {
            return !this.googleId && !this.facebookId
        },
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
        },
        phone: {
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
        enum: ['active', 'blocked', 'pending'],
        default: 'pending'
    },
    createAt: {
        type: Date,
        default: Date.now
    },
    updateAt: {
        type: Date,
        default: Date.now
    },
    lastLoginAt: {
        type: Date,
        default: Date.now
    }

}, {
    timestamps: true
}
);

UserSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 12);
    }
    next();
});

UserSchema.methods.getResetPasswordToken = function () {
    const resetToken = crypto.randomBytes(20).toString('hex');
    this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    return resetToken;
};

UserSchema.methods.getResetPassword = async function () {
    const upperCase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowerCase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const specialChars = '!@#$%^&*()_+~`|}{[]:;?><,./-=';
    const allChars = upperCase + lowerCase + numbers + specialChars;

    // Bắt buộc mỗi loại ký tự có ít nhất 1
    let password = '';
    password += upperCase[Math.floor(Math.random() * upperCase.length)];
    password += lowerCase[Math.floor(Math.random() * lowerCase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += specialChars[Math.floor(Math.random() * specialChars.length)];

    // Tạo các ký tự ngẫu nhiên cho các vị trí còn lại
    for (let i = password.length; i < 16; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Trộn đều các ký tự trong mật khẩu
    const shuffledPassword = password.split('').sort(() => 0.5 - Math.random()).join('');
    console.log(shuffledPassword.toString());
    return shuffledPassword.toString();

};
UserSchema.methods.isAdmin = function () {
    return this.role === 'admin';
};

//compile the schema into a model
export default mongoose.model("User", UserSchema)