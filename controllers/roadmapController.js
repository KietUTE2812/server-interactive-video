import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import ErrorResponse from "../utils/ErrorResponse.js";
import generateRoadmap from "../utils/generateByOpenAI.js";
import Roadmap from "../models/Roadmap.js";

const createRoadmap = asyncHandler(async (req, res, next) => {
    const {formData} = req.body;
    const userId = req.user._id;
    console.log(formData)
    const user = await User.findById(userId);
    if(!user) {
        return next(new ErrorResponse(`User not found with id of ${userId}`, 404));
    }
    if(!formData.learningGoal || !formData.timeCommitment) {
        return next(new ErrorResponse('Please provide all required fields', 400));
    }
    const prompt = `
        I have a user with the following information:
        - Experience level: ${formData.experienceLevel}
        - Current skills: ${formData.currentSkills}
        - Learning goal: ${formData.learningGoal.description} (${formData.learningGoal.label})
        - Time commitment: ${formData.timeCommitment} hours per week
        Create a JSON String for the roadmap for this user to achieve their learning goals. Break it down into phases and suggest specific skills and technologies they should learn in each phase, with an estimated time for each phase. If possible, recommend projects they can work on to apply their knowledge.
        Roadmap model:
        const mongoose = require('mongoose');
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

module.exports = Roadmap;
        `;
    const response = await generateRoadmap(prompt);
    if(!response || !response.data.title) {
        return next(new ErrorResponse('Failed to generate roadmap', 500));
    }
    const data = response.data
    const roadmap = await Roadmap.create({
        title: data.title,
        description: data.description,
        phases: data.phases,
        creator: userId,
        visibility: 'private',
        category: data.category,
        tags: data.tags,
        difficulty: data.difficulty,
        estimatedTimeInMonths: data.estimatedTimeInMonths
    });
    if(!roadmap) {
        return next(new ErrorResponse('Failed to create roadmap', 500));
    }
    res.json({ success: true, data: roadmap });
});

const getRoadmaps = asyncHandler(async (req, res, next) => {
    const filter = req.query;
    let roadmap = null
    if(filter.userId)
        roadmap = await Roadmap.findOne({ creator: filter.userId });
    else if(filter !== {})
        roadmap = await Roadmap.find(filter);
    if(!roadmap) {
        return next(new ErrorResponse(`Roadmap not found`, 404));
    }
    res.json({ success: true, data: roadmap });
})

export default { createRoadmap, getRoadmaps };