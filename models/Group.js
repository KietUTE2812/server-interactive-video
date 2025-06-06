import mongoose from "mongoose";

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    users: [{
        type: mongoose.Schema.Types.ObjectId,   
        ref: "User",
    }],
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, {timestamps: true});

const Group = mongoose.model("Group", groupSchema);

export default Group;

