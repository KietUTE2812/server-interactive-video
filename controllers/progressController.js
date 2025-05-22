import Progress from "../models/Progress.js";
import { Module, ModuleItem } from "../models/Module.js";
import mongoose from "mongoose";
import ErrorResponse from "../utils/ErrorResponse.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import Course from "../models/Course.js";
import ModuleProgress from "../models/Progress.js";

/**
 * @desc    Cập nhật tiến độ xem video
 * @route   PUT /api/v1/progress/:id/video
 * @access  Private
 */
const updateVideoProgress = asyncHandler(async (req, res, next) => {
  const { progressVideo } = req.body;
  const { id } = req.params;
  const userId = req.user.id;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const progress = await Progress.findById(id)
      .populate("moduleItemProgresses.moduleItemId")
      .session(session);

    if (!progress) {
      await session.abortTransaction();
      return next(new ErrorResponse("Progress not found", 404));
    }

    const module = await Module.findById(progress.moduleId)
      .populate("moduleItems")
      .session(session);

    if (!module) {
      await session.abortTransaction();
      return next(new ErrorResponse("Module not found", 404));
    }

    const videoId = progressVideo.videoId;
    const moduleItem = module.moduleItems.find(
      (item) => item.video && item.video.toString() === videoId
    );

    if (!moduleItem) {
      await session.abortTransaction();
      return next(new ErrorResponse("Video not found in the module", 404));
    }

    // Tìm tiến độ hiện tại của video
    let videoProgress = progress.moduleItemProgresses.find(
      (item) => item.moduleItemId._id.toString() === moduleItem._id.toString()
    );

    const isCompleted = progressVideo.completionPercentage >= 95; // Coi như hoàn thành khi đạt 95% để tránh các vấn đề về kỹ thuật

    // Nếu đã hoàn thành và đang thử hoàn thành lại, không cần cập nhật
    if (videoProgress && videoProgress.status === "completed" && isCompleted) {
      await session.abortTransaction();
      return res.status(200).json({
        success: true,
        data: progress,
        message: "Video already completed",
      });
    }

    // Cập nhật thông tin tiến độ
    if (videoProgress) {
      // Chỉ cập nhật trạng thái thành hoàn thành khi đạt ngưỡng
      if (isCompleted && videoProgress.status !== "completed") {
        videoProgress.status = "completed";
        videoProgress.completedAt = new Date();
      } else if (!isCompleted) {
        videoProgress.status = "in-progress";
      }

      // Cập nhật các thông số khác
      videoProgress.timeSpent = Math.max(
        progressVideo.timeSpent || 0,
        videoProgress.timeSpent || 0
      );
      videoProgress.attempts = (videoProgress.attempts || 0) + 1;
      videoProgress.completionPercentage = progressVideo.completionPercentage;
      videoProgress.result.video = {
        ...videoProgress.result.video,
        ...progressVideo,
        lastUpdated: new Date(),
      };

      // Cập nhật lại mảng moduleItemProgresses
      progress.moduleItemProgresses = progress.moduleItemProgresses.map(
        (item) =>
          item._id.toString() === videoProgress._id.toString()
            ? videoProgress
            : item
      );
    } else {
      // Tạo mới tiến độ cho video
      const newProgress = {
        moduleItemId: moduleItem._id,
        status: isCompleted ? "completed" : "in-progress",
        completionPercentage: progressVideo.completionPercentage,
        startedAt: new Date(),
        completedAt: isCompleted ? new Date() : null,
        timeSpent: progressVideo.timeSpent || 0,
        attempts: 1,
        result: {
          video: {
            ...progressVideo,
            lastUpdated: new Date(),
          },
        },
      };
      progress.moduleItemProgresses.push(newProgress);
    }

    // Cập nhật tiến độ tổng thể của module
    //await updateModuleCompletionPercentage(progress, module, session);

    // Lưu tiến độ và commit transaction
    await progress.save({ session });
    await session.commitTransaction();
    session.endSession();

    // Cập nhật tiến độ toàn khóa học (async, không đợi)
    // updateCourseProgress(userId, progress.courseId).catch((err) =>
    //   console.error("Error updating course progress:", err)
    // );

    res.status(200).json({
      success: true,
      data: progress,
      message: isCompleted
        ? "Video completed successfully"
        : "Video progress updated",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(
      new ErrorResponse(`Error updating video progress: ${error.message}`, 400)
    );
  }
});

const updateSupplementProgress = asyncHandler(async (req, res, next) => {
  const { progressSupplement } = req.body;
  const { id } = req.params;
  const userId = req.user.id;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!id) {
      await session.abortTransaction();
      return next(new ErrorResponse("Progress ID is required", 400));
    }

    const progress = await Progress.findById(id)
      .populate("moduleItemProgresses.moduleItemId")
      .session(session);

    if (!progress) {
      await session.abortTransaction();
      return next(new ErrorResponse("Progress not found", 404));
    }

    const module = await Module.findById(progress.moduleId)
      .populate("moduleItems")
      .session(session);

    if (!module) {
      await session.abortTransaction();
      return next(new ErrorResponse("Module not found", 404));
    }

    const supplementId = progressSupplement.supplementId;
    const moduleItem = module.moduleItems.find(
      (item) => item._id.toString() === supplementId
    );

    if (!moduleItem) {
      await session.abortTransaction();
      return next(new ErrorResponse("Supplement not found in the module", 404));
    }

    // Tìm index của progress item cần cập nhật (nếu có)
    let supplementProgressIndex = -1;

    // Xử lý cả 2 trường hợp: đã populate và chưa populate
    progress.moduleItemProgresses.forEach((item, index) => {
      // Nếu đã populate moduleItemId là một object
      if (
        item.moduleItemId &&
        typeof item.moduleItemId === "object" &&
        item.moduleItemId._id
      ) {
        if (item.moduleItemId._id.toString() === moduleItem._id.toString()) {
          supplementProgressIndex = index;
        }
      }
      // Nếu chưa populate moduleItemId là một ObjectId
      else if (
        item.moduleItemId &&
        item.moduleItemId.toString() === moduleItem._id.toString()
      ) {
        supplementProgressIndex = index;
      }
    });

    const isCompleted = progressSupplement.status === "completed";

    if (supplementProgressIndex !== -1) {
      // Lấy tham chiếu trực tiếp đến object cần cập nhật
      const supplementProgress =
        progress.moduleItemProgresses[supplementProgressIndex];

      // Kiểm tra nếu tài liệu đã hoàn thành
      if (
        supplementProgress.status === "completed" &&
        progressSupplement.status === "completed"
      ) {
        await session.abortTransaction();
        session.endSession();
        return res.status(200).json({
          success: true,
          data: progress,
          message: "Supplement already completed",
        });
      }

      // Cập nhật trực tiếp vào object hiện có
      supplementProgress.status = progressSupplement.status;
      supplementProgress.completionPercentage = isCompleted
        ? 100
        : progressSupplement.completionPercentage ||
          supplementProgress.completionPercentage ||
          0;

      if (isCompleted && !supplementProgress.completedAt) {
        supplementProgress.completedAt = new Date();
      }

      // Cập nhật thời gian và số lần thử
      supplementProgress.timeSpent =
        (supplementProgress.timeSpent || 0) +
        (progressSupplement.timeSpent || 0);
      supplementProgress.attempts = (supplementProgress.attempts || 0) + 1;

      // Cập nhật kết quả chi tiết
      if (!supplementProgress.result) {
        supplementProgress.result = {};
      }

      supplementProgress.result.reading = {
        ...(supplementProgress.result.reading || {}),
        status: progressSupplement.status,
        lastPosition: progressSupplement.lastPosition || 0,
        lastUpdated: new Date(),
      };
    } else {
      // Tạo mới tiến độ cho supplement
      const newProgress = {
        moduleItemId: moduleItem._id,
        status: progressSupplement.status,
        completionPercentage: isCompleted
          ? 100
          : progressSupplement.completionPercentage || 0,
        startedAt: new Date(),
        completedAt: isCompleted ? new Date() : null,
        timeSpent: progressSupplement.timeSpent || 0,
        attempts: 1,
        result: {
          reading: {
            status: progressSupplement.status,
            lastPosition: progressSupplement.lastPosition || 0,
            lastUpdated: new Date(),
          },
        },
      };

      progress.moduleItemProgresses.push(newProgress);
    }

    // Cập nhật tiến độ tổng thể của module bằng hàm mới
    //await updateModuleCompletionPercentage(progress, module, session);

    // Lưu tiến độ
    await progress.save({ session });
    await session.commitTransaction();
    session.endSession();

    // Cập nhật tiến độ toàn khóa học (async, không đợi)
    // updateCourseProgress(userId, progress.courseId).catch((err) =>
    //   console.error("Error updating course progress:", err)
    // );

    res.status(200).json({
      success: true,
      data: progress,
      message: isCompleted
        ? "Supplement completed successfully"
        : "Supplement progress updated",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(
      new ErrorResponse(
        `Error updating supplement progress: ${error.message}`,
        400
      )
    );
  }
});
/**
 * Helper function - Tạo hoặc lấy tiến độ module
 */
const createOrGetModuleProgress = asyncHandler(
  async (userId, moduleId, courseId, session) => {
    try {
      // Sử dụng findOneAndUpdate với option upsert để đảm bảo tạo duy nhất
      const moduleProgress = await Progress.findOneAndUpdate(
        {
          userId: userId,
          moduleId: moduleId,
          courseId: courseId,
        },
        {
          $setOnInsert: {
            userId: userId,
            moduleId: moduleId,
            courseId: courseId,
            status: "in-progress",
            completionPercentage: 0,
            moduleItemProgresses: [],
            startedAt: new Date(),
          },
        },
        {
          new: true,
          upsert: true,
          session: session,
        }
      );

      return moduleProgress;
    } catch (error) {
      console.error("Error creating or getting module progress:", error);
      throw new Error("Error creating or getting module progress");
    }
  }
);

/**
 * Helper function - Tìm hoặc tạo tiến độ module item
 */
const findOrCreateModuleItemProgress = (
  moduleProgress,
  moduleItemId,
  itemType = null
) => {
  // Tìm moduleItemProgress với moduleItemId đã cho
  const existingItemProgress = moduleProgress.moduleItemProgresses.find(
    (item) => item.moduleItemId.toString() === moduleItemId.toString()
  );

  // Nếu đã tồn tại, trả về item đó
  if (existingItemProgress) {
    return existingItemProgress;
  }

  // Nếu chưa tồn tại, tạo mới
  const newModuleItemProgress = {
    moduleItemId: moduleItemId,
    status: "in-progress",
    completionPercentage: 0,
    attempts: 0,
    timeSpent: 0,
    startedAt: new Date(),
    completedAt: null,
    result: getDefaultResultByType(itemType || "unknown"),
  };

  // Thêm vào mảng moduleItemProgresses
  moduleProgress.moduleItemProgresses.push(newModuleItemProgress);

  // Trả về moduleItemProgress mới tạo
  return newModuleItemProgress;
};

/**
 * @desc    Cập nhật tiến độ bài tập lập trình
 * @route   PUT /api/v1/progress/:id/programming
 * @access  Private
 */
const updateProgrammingProgress = asyncHandler(async (req, res, next) => {
  const { progressProgramming, moduleItemId, moduleId } = req.body;
  const userId = req.user.id;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!moduleId || !moduleItemId) {
      await session.abortTransaction();
      return next(
        new ErrorResponse("Module ID and Module Item ID are required", 400)
      );
    }

    const module = await Module.findById(moduleId).session(session);
    if (!module) {
      await session.abortTransaction();
      return next(new ErrorResponse("Module not found", 404));
    }

    const moduleItem = await ModuleItem.findById(moduleItemId).session(session);
    if (!moduleItem) {
      await session.abortTransaction();
      return next(new ErrorResponse("Module item not found", 404));
    }

    const course = await Course.findOne({ modules: moduleId }).session(session);
    if (!course) {
      await session.abortTransaction();
      return next(new ErrorResponse("Course not found", 404));
    }

    // Tạo hoặc lấy module progress
    const moduleProgress = await createOrGetModuleProgress(
      userId,
      moduleId,
      course._id,
      session
    );

    // Tìm hoặc tạo module item progress
    const moduleItemProgress = findOrCreateModuleItemProgress(
      moduleProgress,
      moduleItemId,
      "programming"
    );

    // Cập nhật thông tin tiến độ lập trình
    const isCompleted =
      progressProgramming.isPassed ||
      (progressProgramming.score && progressProgramming.score >= 80);

    // Cập nhật trạng thái và tiến độ
    moduleItemProgress.status = isCompleted ? "completed" : "in-progress";
    moduleItemProgress.completionPercentage = isCompleted
      ? 100
      : Math.min(
          100,
          progressProgramming.score ||
            moduleItemProgress.completionPercentage ||
            0
        );

    // Cập nhật thời gian
    if (isCompleted && !moduleItemProgress.completedAt) {
      moduleItemProgress.completedAt = new Date();
    }

    // Cập nhật số lần thử và thời gian
    moduleItemProgress.attempts = (moduleItemProgress.attempts || 0) + 1;
    moduleItemProgress.timeSpent =
      (moduleItemProgress.timeSpent || 0) +
      (progressProgramming.timeSpent || 0);

    // Cập nhật kết quả chi tiết
    moduleItemProgress.result.programming = {
      ...moduleItemProgress.result.programming,
      ...progressProgramming,
      lastUpdated: new Date(),
    };

    // Cập nhật tiến độ module
    //await updateModuleCompletionPercentage(moduleProgress, module, session);

    // Lưu tiến độ
    await moduleProgress.save({ session });
    await session.commitTransaction();
    session.endSession();

    // Cập nhật tiến độ khóa học (async)
    updateCourseProgress(userId, course._id).catch((err) =>
      console.error("Error updating course progress:", err)
    );

    return res.status(200).json({
      success: true,
      data: {
        moduleItemProgress,
        moduleProgress,
      },
      message: isCompleted
        ? "Programming exercise completed"
        : "Programming progress updated",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(
      new ErrorResponse(
        `Error updating programming progress: ${error.message}`,
        500
      )
    );
  }
});

/**
 * @desc    Lấy tiến độ bài tập lập trình theo ID bài toán
 * @route   GET /api/v1/progress/programming/:id
 * @access  Private
 */
const getProgrammingProgressByProblemId = asyncHandler(
  async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user.id;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Tìm module item chứa bài tập lập trình này
      const moduleItem = await ModuleItem.findOne({ programming: id }).session(
        session
      );
      if (!moduleItem) {
        await session.abortTransaction();
        return next(new ErrorResponse("Programming problem not found", 404));
      }

      const module = await Module.findById(moduleItem.module).session(session);
      if (!module) {
        await session.abortTransaction();
        return next(new ErrorResponse("Module not found", 404));
      }

      const course = await Course.findOne({ modules: module._id }).session(
        session
      );
      if (!course) {
        await session.abortTransaction();
        return next(new ErrorResponse("Course not found", 404));
      }

      // Tạo hoặc lấy module progress
      const moduleProgress = await createOrGetModuleProgress(
        userId,
        module._id,
        course._id,
        session
      );

      // Tìm hoặc tạo module item progress
      const moduleItemProgress = findOrCreateModuleItemProgress(
        moduleProgress,
        moduleItem._id,
        "programming"
      );

      // Lưu tiến độ nếu có thay đổi
      if (moduleProgress.isModified()) {
        await moduleProgress.save({ session });
      }

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        data: {
          moduleItemProgress,
          moduleProgress,
          problemId: id,
        },
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      return next(
        new ErrorResponse(
          `Error getting programming progress: ${error.message}`,
          500
        )
      );
    }
  }
);

/**
 * @desc    Lấy tiến độ học tập của người dùng trong một khóa học
 * @route   GET /api/v1/progress
 * @access  Private
 */
const getProgress = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  let courseId;
  if (typeof req.query.courseId === "object") {
    // Trường hợp gửi object, có thể lấy id từ object đó
    courseId = req.query.courseId.id || req.query.courseId._id;
  } else {
    // Trường hợp bình thường
    courseId = req.query.courseId;
  } 

  if (!courseId) {
    return next(new ErrorResponse("Course ID is required", 400));
  }
  console.log("courseId:", courseId);
  
  try {
    // Tìm progress hiện có
    let progress = await Progress.find({ userId, courseId })
      .populate({
        path: "moduleItemProgresses.moduleItemId",
        select: "title type description duration video quiz programming",
      })
      .populate("moduleId", "title index");

    // Nếu không có progress, tạo mới
    if (!progress || progress.length === 0) {
      console.log("Progress not found, creating new records");
      
      // Lấy thông tin về các module của khóa học
      const course = await Course.findById(courseId).populate({
        path: 'modules',
        populate: {
          path: 'moduleItems'
        }
      });
      
      if (!course) {
        return next(new ErrorResponse("Course not found", 404));
      }
      
      // Tạo progress mới cho mỗi module
      const progressPromises = [];
      
      for (const moduleId of course.modules) {
        // Tìm module chi tiết
        const module = await Module.findById(moduleId)
          .populate('moduleItems');
        
        if (module) {
          // Tạo progress items cho các module items
          const moduleItemProgresses = module.moduleItems.map(item => ({
            moduleItemId: item._id,
            status: 'not-started',
            completionPercentage: 0,
            attempts: 0,
            timeSpent: 0
          }));
          
          // Tạo progress cho module
          const newProgress = new Progress({
            userId,
            courseId,
            moduleId: module._id,
            status: 'not-started',
            completionPercentage: 0,
            moduleItemProgresses,
            totalTimeSpent: 0,
            averageScore: 0
          });
          
          progressPromises.push(newProgress.save());
        }
      }
      
      // Lưu tất cả progress
      if (progressPromises.length > 0) {
        progress = await Promise.all(progressPromises);
        
        // Tải lại thông tin progress với populate
        progress = await Progress.find({ userId, courseId })
          .populate({
            path: "moduleItemProgresses.moduleItemId",
            select: "title type description duration video quiz programming",
          })
          .populate("moduleId", "title index");
      } else {
        console.log("No modules found for course");
        return next(new ErrorResponse("No modules found for this course", 404));
      }
    }    // Sắp xếp theo thứ tự module
    progress.sort((a, b) => a.moduleId.index - b.moduleId.index);

    // Định nghĩa trọng số cho từng loại module item (giống như trong Progress.js)
    const ITEM_WEIGHTS = {
      lecture: 3,
      quiz: 2,
      programming: 4,
      supplement: 1
    };

    // Tính tổng tiến độ khóa học dựa trên trọng số của module items
    let totalWeight = 0;
    let completedWeight = 0;
    let totalModuleItems = 0;
    let completedModuleItems = 0;

    // Đếm tổng số module items và số module items đã hoàn thành, tính trọng số
    progress.forEach(moduleProgress => {
      moduleProgress.moduleItemProgresses.forEach(itemProgress => {
        totalModuleItems++;
        
        // Lấy thông tin module item
        const moduleItem = itemProgress.moduleItemId;
        const itemType = moduleItem && moduleItem.type ? moduleItem.type : 
                        (moduleItem && moduleItem.video ? 'lecture' : 
                         moduleItem && moduleItem.quiz ? 'quiz' : 
                         moduleItem && moduleItem.programming ? 'programming' : 'supplement');
        
        // Lấy trọng số cho loại item này
        const weight = ITEM_WEIGHTS[itemType] || 1;
        
        // Cộng vào tổng trọng số
        totalWeight += weight;
        
        if (itemProgress.status === "completed") {
          completedModuleItems++;
          completedWeight += weight;
        } else if (itemProgress.completionPercentage > 0) {
          // Nếu đã bắt đầu nhưng chưa hoàn thành, tính phần trăm theo tiến độ
          const partialWeight = (weight * itemProgress.completionPercentage / 100);
          completedWeight += partialWeight;
        }
      });
    });

    // Tính phần trăm hoàn thành khóa học dựa trên trọng số
    const courseCompletionPercentage =
      totalWeight > 0
        ? Math.round((completedWeight / totalWeight) * 100)
        : 0;
    
    // Tính phần trăm đơn giản để so sánh
    const simpleCompletionPercentage =
      totalModuleItems > 0
        ? Math.round((completedModuleItems / totalModuleItems) * 100)
        : 0;    // Giữ lại thông tin về số lượng modules để tương thích ngược
    const totalModules = progress.length;
    const completedModules = progress.filter(
      (p) => p.status === "completed"
    ).length;

    const count = progress.length;
    console.log("Progress count:", progress.length);
    //console.log(`Simple module items completion: ${completedModuleItems}/${totalModuleItems} = ${simpleCompletionPercentage}%`);
    console.log(`Weighted module items completion: ${completedWeight.toFixed(2)}/${totalWeight} = ${courseCompletionPercentage}%`);    
    res.status(200).json({
      success: true,
      count,
      data: progress,
      courseCompletion: {
        totalModules,
        completedModules,
        moduleCompletion: {
          percentage: Math.round((completedModules / totalModules) * 100),
          completedModules,
          totalModules,
        },
        moduleItemCompletion: {
          percentage: simpleCompletionPercentage,
          completedModuleItems,
          totalModuleItems,
        },
        weightedCompletion: {
          percentage: courseCompletionPercentage,
          completedWeight: parseFloat(completedWeight.toFixed(2)),
          totalWeight: totalWeight,
          weights: ITEM_WEIGHTS
        },
        percentage: courseCompletionPercentage, // Using the weighted calculation as the main percentage
      },
    });
  } catch (error) {
    return next(
      new ErrorResponse(`Error getting progress: ${error.message}`, 500)
    );
  }
});

/**
 * @desc    Lấy điểm của học viên trong một khóa học
 * @route   GET /api/v1/progress/grades/:id
 * @access  Private
 */
const getGradeByCourseId = asyncHandler(async (req, res, next) => {
  const { id: courseId } = req.params;
  const { ids: moduleItemIds } = req.query;
  const userId = req.user.id;

  try {
    if (!courseId) {
      return next(new ErrorResponse("Course ID is required", 400));
    }

    // Chuyển đổi ids sang mảng nếu cần
    const parsedModuleItemIds = Array.isArray(moduleItemIds)
      ? moduleItemIds
      : moduleItemIds
      ? [moduleItemIds].filter(Boolean)
      : [];

    // Xây dựng query
    const query = {
      courseId,
      userId,
    };

    // Nếu có module item ids, chỉ lọc theo các ids này
    if (parsedModuleItemIds.length > 0) {
      query["moduleItemProgresses.moduleItemId"] = { $in: parsedModuleItemIds };
    }

    // Tìm kiếm progress
    const progresses = await Progress.find(query)
      .populate({
        path: "moduleItemProgresses.moduleItemId",
        select: "title type",
      })
      .select("moduleItemProgresses moduleId")
      .lean();

    // Nếu không có progress, trả về mảng rỗng
    if (!progresses || progresses.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No progress found for this course",
      });
    }

    // Trích xuất và lọc moduleItemProgresses
    let filteredProgresses = [];

    if (parsedModuleItemIds.length > 0) {
      // Nếu có ids cụ thể, chỉ lọc theo ids này
      filteredProgresses = progresses.flatMap((progress) =>
        progress.moduleItemProgresses.filter((item) =>
          parsedModuleItemIds.includes(item.moduleItemId.toString())
        )
      );
    } else {
      // Nếu không, lấy tất cả
      filteredProgresses = progresses.flatMap((progress) => {
        // Thêm thông tin moduleId vào mỗi item
        return progress.moduleItemProgresses.map((item) => ({
          ...item,
          moduleId: progress.moduleId,
        }));
      });
    }

    // Tổng hợp điểm theo loại
    const quizScores = filteredProgresses
      .filter((p) => p.moduleItemId?.type === "quiz")
      .map((p) => p.result?.quiz?.score || 0);

    const programmingScores = filteredProgresses
      .filter((p) => p.moduleItemId?.type === "programming")
      .map((p) => p.result?.programming?.score || 0);

    // Tính điểm trung bình
    const averageQuizScore =
      quizScores.length > 0
        ? quizScores.reduce((sum, score) => sum + score, 0) / quizScores.length
        : 0;

    const averageProgrammingScore =
      programmingScores.length > 0
        ? programmingScores.reduce((sum, score) => sum + score, 0) /
          programmingScores.length
        : 0;

    // Tính điểm tổng hợp
    const overallScore = [
      { score: averageQuizScore, weight: 0.4 },
      { score: averageProgrammingScore, weight: 0.6 },
    ].reduce((sum, item) => sum + item.score * item.weight, 0);

    res.status(200).json({
      success: true,
      data: filteredProgresses,
      summary: {
        averageQuizScore: Math.round(averageQuizScore * 10) / 10,
        averageProgrammingScore: Math.round(averageProgrammingScore * 10) / 10,
        overallScore: Math.round(overallScore * 10) / 10,
      },
    });
  } catch (error) {
    return next(
      new ErrorResponse(`Error getting grades: ${error.message}`, 500)
    );
  }
});

/**
 * @desc    Kiểm tra tiến độ hoàn thành khóa học
 * @route   GET /api/v1/progress/check/:id
 * @access  Private
 */
// const getCheckProgress = asyncHandler(async (req, res, next) => {
//   const { id: courseId } = req.params;
//   const userId = req.user.id;

//   try {
//     if (!courseId) {
//       return next(new ErrorResponse("Course ID is required", 400));
//     }

//     // Tìm tất cả progress của khóa học và user này
//     const progresses = await Progress.find({
//       courseId: courseId,
//       userId: userId,
//     });

//     if (!progresses || progresses.length === 0) {
//       return res.status(200).json({
//         success: true,
//         isAllCompleted: false,
//         completionPercentage: 0,
//         message: "No progress found for this course",
//       });
//     }

//     // Kiểm tra xem có progress nào không phải trạng thái completed không
//     const completedCount = progresses.filter(
//       (progress) => progress.status === "completed"
//     ).length;

//     const totalModules = progresses.length;
//     const completionPercentage = Math.round(
//       (completedCount / totalModules) * 100
//     );
//     const isAllCompleted = completedCount === totalModules && totalModules > 0;

//     // Trả về kết quả
//     return res.status(200).json({
//       success: true,
//       isAllCompleted,
//       completionPercentage,
//       completedModules: completedCount,
//       totalModules,
//     });
//   } catch (error) {
//     return next(
//       new ErrorResponse(`Error checking progress: ${error.message}`, 500)
//     );
//   }
// });

/**
 * Xác định loại module item
 * @param {Object} item - Module item cần xác định loại
 * @returns {String} Loại của module item
 */
const getItemType = (item) => {
  if (!item) return "unknown";

  if (item.type) return item.type;

  if (item.video) return "video";
  if (item.quiz) return "quiz";
  if (item.programming) return "programming";
  if (item.supplement) return "supplement";

  return "unknown";
};

/**
 * @desc    Lấy tiến độ của một module item
 * @route   GET /api/progresses/module-items/:id
 * @access  Private
 */
const getModuleItemProgress = asyncHandler(async (req, res, next) => {
  const { id: moduleItemId } = req.params;
  const userId = req.user.id;

  // Khởi tạo session cho transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Bước 1: Tìm progress hiện có với module item này
    const existingProgress = await ModuleProgress.findOne({
      userId,
      "moduleItemProgresses.moduleItemId": moduleItemId,
    }).session(session);

    // Nếu tìm thấy progress, trả về module item progress cụ thể
    if (existingProgress) {
      const moduleItemProgress = existingProgress.moduleItemProgresses.find(
        (item) => item.moduleItemId.toString() === moduleItemId.toString()
      );

      if (moduleItemProgress) {
        // Commit transaction vì không cần thay đổi dữ liệu
        await session.commitTransaction();
        session.endSession();

        // Populate thông tin cho module item
        const populatedProgress = await ModuleProgress.findById(
          existingProgress._id
        ).populate({
          path: "moduleItemProgresses.moduleItemId",
          select: "title type description duration",
        });

        const populatedItemProgress =
          populatedProgress.moduleItemProgresses.find(
            (item) =>
              item.moduleItemId._id.toString() === moduleItemId.toString()
          );

        return res.status(200).json({
          success: true,
          data: populatedItemProgress,
        });
      }
    }

    // Bước 2: Nếu không tìm thấy, lấy thông tin về module item
    const moduleItem = await mongoose
      .model("ModuleItem")
      .findById(moduleItemId)
      .session(session);
    if (!moduleItem) {
      await session.abortTransaction();
      session.endSession();
      return next(new ErrorResponse("Module item not found", 404));
    }

    // Bước 3: Tìm course chứa module này
    const course = await Course.findOne({ modules: moduleItem.module }).session(
      session
    );
    if (!course) {
      await session.abortTransaction();
      session.endSession();
      return next(new ErrorResponse("Course not found", 404));
    }

    // Bước 4: Kiểm tra có progress cho module này không
    let progress = await ModuleProgress.findOne({
      userId,
      moduleId: moduleItem.module,
      courseId: course._id,
    }).session(session);

    // Bước 5: Nếu không có, tạo mới progress cho module
    if (!progress) {
      progress = new ModuleProgress({
        userId,
        moduleId: moduleItem.module,
        courseId: course._id,
        startedAt: new Date(),
        status: "in-progress",
        completionPercentage: 0,
        moduleItemProgresses: [],
        totalTimeSpent: 0,
        averageScore: 0,
      });
    }

    // Bước 6: Thêm module item progress vào mảng
    const newModuleItemProgress = {
      moduleItemId,
      status: "not-started",
      completionPercentage: 0,
      startedAt: new Date(),
      completedAt: null,
      attempts: 0,
      timeSpent: 0,
      result: getDefaultResultByType(moduleItem.type),
    };

    progress.moduleItemProgresses.push(newModuleItemProgress);

    // Bước 7: Lưu progress
    await progress.save({ session });
    await session.commitTransaction();
    session.endSession();

    // Bước 8: Populate và trả về kết quả
    const updatedProgress = await ModuleProgress.findById(
      progress._id
    ).populate({
      path: "moduleItemProgresses.moduleItemId",
      select: "title type description duration",
    });

    const createdItemProgress = updatedProgress.moduleItemProgresses.find(
      (item) => item.moduleItemId.toString() === moduleItemId.toString()
    );

    return res.status(201).json({
      success: true,
      data: createdItemProgress,
      message: "Module item progress created successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(
      new ErrorResponse(
        `Error getting module item progress: ${error.message}`,
        500
      )
    );
  }
});

/**
 * Helper function to get default result object structure based on module item type
 */
const getDefaultResultByType = (type) => {
  switch (type) {
    case "quiz":
      return {
        quiz: {
          score: 0,
          totalQuestions: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          timeSpent: 0,
          isPassed: false,
          answers: [],
        },
      };
    case "programming":
      return {
        programming: {
          submissionId: null,
          testCasesPassed: 0,
          totalTestCases: 0,
          score: 0,
          code: "",
          language: "",
          compilationError: "",
          executionTime: 0,
          memory: "",
        },
      };
    case "reading":
      return {
        reading: {
          status: "not-started",
        },
      };
    case "video":
      return {
        video: {
          watchedDuration: 0,
          totalDuration: 0,
          lastPosition: 0,
          completionPercentage: 0,
          notes: [],
        },
      };
    default:
      return {};
  }
};

const getModuleProgress = asyncHandler(async (req, res, next) => {
  const moduleId = req.params.id;
  const userId = req.user.id;

  if (!mongoose.Types.ObjectId.isValid(moduleId)) {
    return res.status(400).json({ message: "Module ID không hợp lệ" });
  }

  // Tìm module
  const module = await Module.findById(moduleId).populate("moduleItems");
  if (!module) {
    return res.status(404).json({ message: "Module not found" });
  }

  // Tìm progress đã có (nếu có)
  let progress = await ModuleProgress.findOne({ userId, moduleId });
  if (!progress) {
    res.status(404).json({ message: "Progress not found" });
  }

  res.status(200).json(progress);
});

export default {
  updateVideoProgress,
  updateSupplementProgress,
  updateProgrammingProgress,
  getProgrammingProgressByProblemId,
  getProgress,
  getGradeByCourseId,
  getModuleItemProgress,
  getModuleProgress,
};
