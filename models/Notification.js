import mongoose from "mongoose";

const Schema = mongoose.Schema;

const NotificationSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: function() {
            return !this.userGroup && !this.email && !this.isSystem;
        }
    },
    userGroup: {
        type: String,
        required: function() {
            return !this.user && !this.email && !this.isSystem;
        }
    },
    email: {
        type: String,
        required: function() {
            return !this.user && !this.userGroup && !this.isSystem;
        },
        validate: {
            validator: function(v) {
                return /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/.test(v);
            },
            message: props => `${props.value} is not a valid email address!`
        }
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    htmlContent: {
        type: String,
        default: null
    },
    link: {
        type: String,
        default: '#'
    },
    read: {
        type: Boolean,
        default: false
    },
    notificationType: {
        type: String,
        enum: ['individual', 'group', 'broadcast', 'email'],
        default: 'individual'
    },
    deliveryMethod: {
        type: [String],
        enum: ['in-app', 'email', 'push'],
        default: ['in-app']
    },
    emailSent: {
        type: Boolean,
        default: false
    },
    emailSentAt: {
        type: Date,
        default: null
    },
    metadata: {
        type: Object,
        default: {}
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        default: function() {
            const date = new Date();
            date.setDate(date.getDate() + 30); // Default 30 days expiration
            return date;
        }
    },
    isSystem: { // True nếu thông báo là hệ thống gửi cho admin
        type: Boolean,
        default: false
    }
    
}, {
    timestamps: true
});

// Index to improve query performance for users
NotificationSchema.index({ user: 1, read: 1, createdAt: -1 });

// Index for email notifications
NotificationSchema.index({ email: 1, emailSent: 1 });

// Index for expiring notifications
NotificationSchema.index({ expiresAt: 1 });

// Index for group notifications
NotificationSchema.index({ userGroup: 1 });

// Index for system notifications to admin
NotificationSchema.index({ isSystem: 1, targetRole: 1 });

export default mongoose.model('Notification', NotificationSchema);