import Assignment from "../models/Assignment.js"
import CourseGrade from "../models/CourseGrade.js"
import asyncHandler from "../middlewares/asyncHandler.js";
import ErrorResponse from "../utils/ErrorResponse.js";
import Progress from "../models/Progress.js";

// // @desc      Get all course grades
// // @route     GET /api/v1/coursegrades
// // @access    Private

// exports.getCourseGrades = asyncHandler(async (req, res, next) => {
//     const courseGrades = await CourseGrade.find({ userId: req.user.id }).populate('courseId', 'title');
//     res.status(200).json({ success: true, count: courseGrades.length, data: courseGrades });
// });

// @desc      Get single course grade
// @route     GET /api/v1/coursegrades/:id
// @access    Private
export const getCourseGrade = asyncHandler(async (req, res, next) => {
    const { courseId } = req.params;
    const courseGrade = await CourseGrade.findOne({ courseId, userId: req.user.id }).populate('assignments');

    if (!courseGrade) {
        return next(new ErrorResponse(`Course grade not found with id of ${req.params.id}`, 404));
    }

    res.status(200).json({ success: true, data: courseGrade });
});

// @desc      create or update course grade
// @route     POST /api/v1/coursegrades
// @access    Private
export const updateCourseGrade = asyncHandler(async (req, res, next) => {
    const { courseId, overallGrade } = req.body;

    let courseGrade = await CourseGrade.findOne({ courseId, userId: req.user.id });

    if (courseGrade) {
        // Update existing course grade
        const assignments = await Assignment.find({ courseId, userId });

        let totalWeightedScore = 0;
        let totalWeight = 0;

        for (let assignment of assignments) {
            const score = await assignment.getScore();
            totalWeightedScore += score * assignment.weight;
            totalWeight += assignment.weight;
        }

        const calculatedOverallGrade = totalWeight > 0 ? (totalWeightedScore / totalWeight) : 0;

        courseGrade = await CourseGrade.findOneAndUpdate(
            { courseId, userId },
            {
                assignments: assignments.map(a => a._id),
                overallGrade: calculatedOverallGrade,
                lastUpdated: Date.now()
            },
            { new: true, runValidators: true }
        );
    } else {
        // Create new course grade
        const assignments = await Assignment.find({ courseId, userId });

        let totalWeightedScore = 0;
        let totalWeight = 0;

        for (let assignment of assignments) {
            const score = await assignment.getScore();
            totalWeightedScore += score * assignment.weight;
            totalWeight += assignment.weight;
        }

        const calculatedOverallGrade = totalWeight > 0 ? (totalWeightedScore / totalWeight) : 0;

        courseGrade = await CourseGrade.create({
            courseId,
            userId,
            assignments: assignments.map(a => a._id),
            overallGrade: calculatedOverallGrade,
            lastUpdated: Date.now()
        });
    }

    if (!courseGrade) {
        return next(new ErrorResponse('Failed to create or update course grade', 500));
    }

    res.status(200).json({ success: true, data: courseGrade });
});

//@desc Create Assignment + update course grade
//@route POST /api/v1/assignments
//@access Private

export const createAssignment = asyncHandler(async (req, res) => {
    const newAssignment = new Assignment(req.body);
    await newAssignment.save();

    // Update CourseGrade
    await CourseGrade.findOneAndUpdate(
        { courseId: newAssignment.courseId, userId: newAssignment.userId },
        { $push: { assignments: newAssignment._id } },
        { upsert: true, new: true }
    );

    res.status(201).json(newAssignment);
});

// @desc      Update assignment
// @route     PUT /api/v1/assignments/:id
// @access    Private
export const updateAssignment = asyncHandler(async (req, res) => {
    const updatedAssignment = await Assignment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedAssignment) {
        return next(new ErrorResponse('Assignment not found', 404));
    }
    res.status(200).json(updatedAssignment);
});

// @desc Get assignment
// @route GET /api/v1/assignments/:id
// @access Private
export const getAssignment = asyncHandler(async (req, res) => {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
        return next(new ErrorResponse('Assignment not found', 404));
    }
    res.status(200).json(assignment);
});

// @desc Delete assignment
// @route DELETE /api/v1/assignments/:id
// @access Private
export const deleteAssignment = asyncHandler(async (req, res) => {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
        return next(new ErrorResponse('Assignment not found', 404));
    }

    // Remove assignment from CourseGrade
    await CourseGrade.findOneAndUpdate(
        { courseId: assignment.courseId, userId: assignment.userId },
        { $pull: { assignments: assignment._id } }
    );

    await assignment.remove();
    res.status(200).json({ message: "Assignment deleted successfully" });
});

export const getCourseGradeByCourseID = asyncHandler(async (req, res, next) => {
    const courseID = req.params.id;
    const userID = req.user.id;

    // Populate moduleItemId để lấy thông tin type
    const progressDocuments = await Progress.find({
        courseId: courseID,
        userId: userID
    }).populate({
        path: 'moduleItemProgresses.moduleItemId',
        select: 'type title description _id'
    });

    if (!progressDocuments || progressDocuments.length === 0) {
        return res.status(404).json({ message: "Not Found Progress" });
    }

    console.log(`Found ${progressDocuments.length} progress documents.`);

    const relevantModuleItems = progressDocuments.flatMap(doc => {
        if (doc.moduleItemProgresses && Array.isArray(doc.moduleItemProgresses)) {
            return doc.moduleItemProgresses.filter(itemProgress => {
                // Kiểm tra loại module item từ type field
                const moduleItemType = itemProgress.moduleItemId?.type;

                // Kiểm tra nếu type là programming hoặc quiz
                if (moduleItemType === "programming" || moduleItemType === "quiz") {
                    return true;
                }

                // Kiểm tra thêm trong result object nếu có
                if (itemProgress.result) {
                    return itemProgress.result.hasOwnProperty('programming') ||
                        itemProgress.result.hasOwnProperty('quiz');
                }

                return false;
            });
        }
        return [];
    });

    console.log("Filtered module items:", relevantModuleItems);

    // Format data theo yêu cầu
    const formattedData = relevantModuleItems.map(itemProgress => ({
        title: itemProgress.moduleItemId?.title || 'Unknown Title',
        Type: itemProgress.moduleItemId?.type || 'Unknown Type',
        status: itemProgress.status,
        completedAt: itemProgress.completedAt,
        _id: itemProgress.moduleItemId?._id || itemProgress._id,
        completionPercentage: itemProgress.completionPercentage
    }));

    res.status(200).json({
        message: "Successfully retrieved relevant module items.",
        count: formattedData.length,
        data: formattedData
    });
});
