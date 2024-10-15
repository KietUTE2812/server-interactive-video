import mongoose from "mongoose";
const Schema = mongoose.Schema;

const EnrollmentSchema = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' }
});
export default mongoose.model('Enrollment', EnrollmentSchema);