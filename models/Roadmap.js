import mongoose from 'mongoose';
const Schema = mongoose.Schema;

// Schema for individual items in a phase
const RoadmapItemSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    completed: {
        type: Boolean,
        default: false
    },
    order: {
        type: Number,
        required: true
    }
}, { _id: true });

// Schema for phases
const PhaseSchema = new Schema({
    phase: {
        type: Number,
        required: true,
        min: 1
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    duration: {
        type: Number,
        required: true,
        min: 0
    },
    items: [RoadmapItemSchema],
    status: {
        type: String,
        enum: ['not-started', 'in-progress', 'completed'],
        default: 'not-started'
    },
    startDate: {
        type: Date
    },
    endDate: {
        type: Date
    }
}, { _id: true });

// Main Roadmap Schema
const RoadmapSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    phases: [PhaseSchema],
    creator: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    visibility: {
        type: String,
        enum: ['private', 'public', 'shared'],
        default: 'private'
    },
    tags: [{
        type: String,
        trim: true
    }],
    difficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'beginner'
    },
    estimatedTimeInMonths: {
        type: Number,
        min: 0
    },
    category: {
        type: String,
        required: true,
        trim: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for total progress
RoadmapSchema.virtual('progress').get(function() {
    if (!this.phases.length) return 0;

    const completedItems = this.phases.reduce((acc, phase) => {
        return acc + phase.items.filter(item => item.completed).length;
    }, 0);

    const totalItems = this.phases.reduce((acc, phase) => {
        return acc + phase.items.length;
    }, 0);

    return totalItems ? Math.round((completedItems / totalItems) * 100) : 0;
});

// Index for better search performance
RoadmapSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Pre-save middleware to calculate estimatedTimeInMonths
RoadmapSchema.pre('save', function(next) {
    if (this.phases.length) {
        this.estimatedTimeInMonths = this.phases.reduce((acc, phase) => acc + phase.duration, 0);
    }
    next();
});

const Roadmap = mongoose.model('Roadmap', RoadmapSchema);

export default Roadmap;