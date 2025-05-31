import { Module, ModuleItem, Video } from "../models/Module.js";
import Course from "../models/Course.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ErrorResponse from "../utils/ErrorResponse.js";
import mongoose from "mongoose";
import Quiz from "../models/Quiz.js";
import ProgramProblem from "../models/ProgramProblem.js";
import { request } from "express";
import File from "../models/File.js";
import dotenv from "dotenv";
import minioClient from "../config/minioClient.js";

import processAIResponse from "../utils/generatePromt.js";
import GeminiAI from "../utils/GeminiAI.js";
import getGrokAPI from "../utils/grokAPI.js";

// Module Items

//@desc Create module item type supplement
//@route POST /api/v1/learns/:courseId/modules/:moduleId/supplements
//@access Private
export const createModuleItemSupplement = asyncHandler(
  async (req, res, next) => {
    const courseId = req.params.id;
    const moduleId = req.params.moduleId;
    const { title, description } = req.body;

    // Validate inputs
    if (!title || !description) {
      return next(
        new ErrorResponse("Please provide title and description", 400)
      );
    }

    if (!req.file) {
      return next(new ErrorResponse("Please provide a file", 400));
    }

    // Find the course
    const course = await Course.findById(courseId);
    if (!course) {
      return next(
        new ErrorResponse(`No found course with id ${courseId}`, 404)
      );
    }

    // Find the module
    const module = await Module.findOne({
      courseId: course._id,
      index: moduleId,
    });
    if (!module) {
      return next(
        new ErrorResponse(`No found module with id ${moduleId}`, 404)
      );
    }

    // Check authorization
    if (
      course.instructor.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return next(
        new ErrorResponse(`User is not authorized to create module item`, 401)
      );
    }
    const bucketName = process.env.MINIO_BUCKET_NAME;
    const objectName = Date.now() + "_" + req.file.originalname;

    const bucketExists = await minioClient.bucketExists(bucketName);
    if (!bucketExists) {
      await minioClient.makeBucket(bucketName, "us-east-1");
    }

    await minioClient.putObject(
      bucketName,
      objectName,
      req.file.buffer,
      req.file.size,
      {
        "Content-Type": req.file.mimetype,
      }
    );
    const url = `${process.env.MINIO_URL}/${objectName}`;

    const session = await mongoose.startSession();
    try {
      // Start transaction
      await session.startTransaction();

      // 1. Create new module item with session
      const moduleItemData = {
        module: module._id,
        title,
        description,
        type: "supplement",
        contentType: "Reading",
        icon: "read",
        reading: url.toString(),
      };

      // Use create with session in array format as per MongoDB best practices
      await ModuleItem.collection.dropIndexes();
      const [newModuleItem] = await ModuleItem.create([moduleItemData], {
        session,
      });

      console.log("New module item:", newModuleItem);
      // Update module
      await Module.findByIdAndUpdate(
        module._id,
        {
          $push: { moduleItems: newModuleItem._id },
        },
        {
          session,
          new: true,
          runValidators: true,
        }
      );
      await session.commitTransaction();
      res.status(201).json({
        success: true,
        data: newModuleItem,
      });
    } catch (error) {
      await session.abortTransaction();
      console.error("Error creating module item:", error);
      return res.status(500).json({
        success: false,
        error: "Error creating module item",
        details: error.message,
      });
      //return next(new ErrorResponse('Error creating module item', 500));
    } finally {
      // Always end session
      session.endSession();
    }
  }
);

export const createModuleItemLecture = asyncHandler(async (req, res, next) => {
  const courseId = req.params.id;
  const moduleId = req.params.moduleId;
  const { title, description } = req.body;

  // Validation checks
  if (!title || !description) {
    return next(new ErrorResponse("Please provide title and description", 400));
  }

  if (!req.file) {
    return next(new ErrorResponse("Please provide a file", 400));
  }

  // Implement retry mechanism
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction({
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      });

      const course = await Course.findById(courseId).session(session);

      if (!course) {
        await session.abortTransaction();
        return next(
          new ErrorResponse(`No found course with id ${courseId}`, 404)
        );
      }
      const module = await Module.findOne({
        courseId: course._id,
        index: moduleId,
      }).session(session);

      if (!module) {
        await session.abortTransaction();
        return next(
          new ErrorResponse(`No found module with id ${moduleId}`, 404)
        );
      }

      // Authorization check
      if (
        course.instructor.toString() !== req.user.id &&
        req.user.role !== "admin"
      ) {
        await session.abortTransaction();
        return next(
          new ErrorResponse(`User is not authorized to create module item`, 401)
        );
      }

      // Upload to MinIO with error handling
      const bucketName = process.env.MINIO_BUCKET_NAME;
      const objectName = `${Date.now()}_${req.file.originalname}`;

      try {
        const bucketExists = await minioClient.bucketExists(bucketName);
        if (!bucketExists) {
          await minioClient.makeBucket(bucketName, "us-east-1");
        }

        await minioClient.putObject(
          bucketName,
          objectName,
          req.file.buffer,
          req.file.size,
          { "Content-Type": req.file.mimetype }
        );
      } catch (minioError) {
        await session.abortTransaction();
        console.error("MinIO upload error:", minioError);
        return next(new ErrorResponse("Error uploading file", 500));
      }

      // Process questions
      let questionData = req.body.questions;
      console.log("questionData", questionData);
      try {
        if (typeof questionData === "string") {
          questionData = JSON.parse(questionData);
        }
      } catch (parseError) {
        await session.abortTransaction();
        return next(new ErrorResponse("Invalid questions format", 400));
      }

      const questionsArray = Array.isArray(questionData)
        ? questionData
        : [questionData];
      const validQuestions = questionsArray
        .filter(
          (q) =>
            q.index !== null && q.question !== null && q.answers?.length > 0
        )
        .map((q) => ({
          ...q,
          answers: q.answers.filter(
            (a) => a.content !== null && a.isCorrect !== null
          ),
        }));

      // Create video document
      const url = `${process.env.MINIO_URL}/${objectName}`;
      const videoData = {
        file: url.toString(),
        duration: req.body.duration,
        questions: validQuestions,
      };

      const video = await Video.create([videoData], { session });

      // Create module item
      const moduleItemData = {
        module: module._id,
        title,
        description,
        type: "lecture",
        contentType: "Video",
        icon: "video",
        video: video[0]._id,
      };

      const newModuleItem = await ModuleItem.create([moduleItemData], {
        session,
      });

      // Update module with new item
      await Module.findByIdAndUpdate(
        module._id,
        { $push: { moduleItems: newModuleItem[0]._id } },
        { session, new: true, runValidators: true }
      );

      await session.commitTransaction();

      return res.status(201).json({
        success: true,
        data: newModuleItem[0],
      });
    } catch (error) {
      await session.abortTransaction();

      if (error.code === 11000) {
        retryCount++;
        // Wait before retrying with exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, retryCount))
        );
        continue;
      }

      console.error("Transaction error:", error);
      return next(new ErrorResponse("Error creating module item", 500));
    } finally {
      session.endSession();
    }
  }

  // If we've exhausted all retries
  return next(
    new ErrorResponse(
      "Failed to create module item after multiple attempts",
      500
    )
  );
});

export const createModuleItemQuiz = asyncHandler(async (req, res, next) => {
  const courseId = req.params.id;
  const moduleId = req.params.moduleId;

  // Find the course
  const course = await Course.findById(courseId);
  if (!course) {
    return next(new ErrorResponse(`No found course with id ${courseId}`, 404));
  }

  // Find the module
  const module = await Module.findOne({
    courseId: course._id,
    index: moduleId,
  });
  if (!module) {
    return next(new ErrorResponse(`No found module with id ${moduleId}`, 404));
  }

  const quizData = {
    ...req.body,
    module: module._id,
  };
  if (!quizData || !quizData.questions || !Array.isArray(quizData.questions)) {
    return next(
      new ErrorResponse(
        "Please provide valid quiz data with questions array",
        400
      )
    );
  }
  // Check authorization
  if (
    course.instructor.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return next(
      new ErrorResponse(`User is not authorized to create module item`, 401)
    );
  }

  // Use mongoose transaction to ensure data consistency

  try {
    // Create new module item
    // await ModuleItem.collection.dropIndex("moduleId_1");
    //await ModuleItem.collection.dropIndexes();
    const newmoduleItem = await ModuleItem.create(quizData);
    console.log("Module item:", newmoduleItem);
    //await Quiz.collection.dropIndexes();
    const newQuiz = await Quiz.create({
      moduleItem: newmoduleItem._id,
      duration: quizData.duration,
      passingScore: quizData.passingScore,
      questions: formatQuestionData(quizData.questions),
    });
    console.log("quiz", newQuiz);

    await ModuleItem.findByIdAndUpdate(
      newmoduleItem._id,
      { quiz: newQuiz._id },
      { new: true }
    );

    await Module.findByIdAndUpdate(
      module._id,
      { $push: { moduleItems: newmoduleItem._id } },
      { new: true }
    );

    res.status(201).json({
      success: true,
      data: newmoduleItem,
    });
  } catch (error) {
    console.error("Error creating quiz module item:", error);
    return next(new ErrorResponse(error.message, 400));
  }
});

// Helper function to format question data
function formatQuestionData(questions) {
  return questions.map((question) => ({
    orderNumber: question.orderNumber,
    content: question.content,
    type: question.type,
    points: question.points || 1,
    answers: question.answers.map((answer) => ({
      content: answer.content,
      isCorrect: answer.isCorrect,
    })),
    explanation: question.explanation,
  }));
}

export const createModuleItemProgramming = asyncHandler(
  async (req, res, next) => {
    const courseId = req.params.id;
    const moduleId = req.params.moduleId;

    // Find the course
    const course = await Course.findById(courseId);
    if (!course) {
      return next(
        new ErrorResponse(`No found course with id ${courseId}`, 404)
      );
    }

    // Find the module
    const module = await Module.findOne({
      courseId: course._id,
      index: moduleId,
    });
    if (!module) {
      return next(
        new ErrorResponse(`No found module with id ${moduleId}`, 404)
      );
    }

    const formData = {
      ...req.body,
      module: module._id,
    };
    //console.log("user", req.user.id)
    //console.log('formData', formData);
    // Check authorization
    if (
      course.instructor.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return next(
        new ErrorResponse(`User is not authorized to create module item`, 401)
      );
    }

    try {
      await ProgramProblem.collection.dropIndexes();
      const newModuleItem = await ModuleItem.create({
        module: module._id,
        title: formData.title,
        description: formData.description,
        type: "programming",
        contentType: "Programming Assignment",
        icon: "code",
        isGrade: formData.isGrade,
      });

      const newProgram = await ProgramProblem.create({
        problemName: formData.problemName,
        content: formData.content,
        difficulty: formData.difficulty,
        tags: formData.tags,
        constraints: formData.constraints,
        inputFormat: formData.inputFormat,
        outputFormat: formData.outputFormat,
        sampleInput: formData.sampleInput,
        sampleOutput: formData.sampleOutput,
        explanation: formData.explanation,
        editorial: formData.editorial,
        testcases: formData.testcases,
        createdBy: req.user.id,
        baseScore: formData.baseScore,
        timeBonus: formData.timeBonus,
        memoryBonus: formData.memoryBonus,
        codeFormat: formData.codeFormat,
      });

      await ModuleItem.findByIdAndUpdate(
        newModuleItem._id,
        { programming: newProgram._id },
        { new: true }
      );
      await Module.findByIdAndUpdate(
        module._id,
        { $push: { moduleItems: newModuleItem._id } },
        { new: true }
      );

      res.status(201).json({
        success: true,
        data: newModuleItem,
      });
    } catch (error) {
      console.error("Error creating programming module item:", error);
      return next(new ErrorResponse(error.message, 400));
    }
  }
);

//
export const getModuleItemById = asyncHandler(async (req, res, next) => {
  const moduleItemId = req.params.moduleItemId;

  const moduleItem = await ModuleItem.findById(moduleItemId).populate([
    { path: "video", model: "Video" },
    { path: "quiz", model: "Quiz" },
    { path: "programming", model: "ProgramProblem" },
  ]);

  if (!moduleItem) {
    return next(
      new ErrorResponse(`No module item found with id ${moduleItemId}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: moduleItem,
  });
});

export const editSupplementByItemId = asyncHandler(async (req, res, next) => {
  const itemId = req.params.itemId;
  const { title, description } = req.body;

  // Validate inputs
  if (!title || !description) {
    return next(new ErrorResponse("Please provide title and description", 400));
  }

  if (!req.file) {
    return next(new ErrorResponse("Please provide a file", 400));
  }

  console.log("itemId", itemId);
  if (!itemId) {
    return next(new ErrorResponse("Please provide item id", 400));
  }

  const bucketName = process.env.MINIO_BUCKET_NAME;
  const objectName = Date.now() + "_" + req.file.originalname;
  const bucketExists = await minioClient.bucketExists(bucketName);
  if (!bucketExists) {
    await minioClient.makeBucket(bucketName, "us-east-1");
  }

  await minioClient.putObject(
    bucketName,
    objectName,
    req.file.buffer,
    req.file.size,
    {
      "Content-Type": req.file.mimetype,
    }
  );
  const url = `${process.env.MINIO_URL}/${objectName}`;

  const session = await mongoose.startSession();
  try {
    // Start transaction
    await session.startTransaction();

    // 1. Update module item with session
    const moduleItem = await ModuleItem.findByIdAndUpdate(
      itemId,
      {
        title,
        description,
        reading: url.toString(),
      },
      {
        session,
        new: true,
        runValidators: true,
      }
    );
    await session.commitTransaction();
    res.status(200).json({
      success: true,
      data: moduleItem,
    });
  } catch (err) {
    console.error("Error updating module item:", err);
    return next(new ErrorResponse("Error updating module item", 500));
  } finally {
    // Always end session
    session.endSession();
  }
});

export const editLectureByItemId = asyncHandler(async (req, res, next) => {
  const itemId = req.params.itemId;
  const { title, description, questions } = req.body;

  // Validation checks
  if (!title || !description || !questions) {
    return next(new ErrorResponse("Please provide title and description", 400));
  }

  if (!req.file) {
    return next(new ErrorResponse("Please provide a file", 400));
  }
  console.log("test", req.file);
  console.log("questions", questions);
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction({
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      });

      const bucketName = process.env.MINIO_BUCKET_NAME;
      const objectName = `${Date.now()}_${req.file.originalname}`;

      try {
        const bucketExists = await minioClient.bucketExists(bucketName);
        if (!bucketExists) {
          await minioClient.makeBucket(bucketName, "us-east-1");
        }

        await minioClient.putObject(
          bucketName,
          objectName,
          req.file.buffer,
          req.file.size,
          { "Content-Type": req.file.mimetype }
        );
      } catch (minioError) {
        await session.abortTransaction();
        console.error("MinIO upload error:", minioError);
        return next(new ErrorResponse("Error uploading file", 500));
      }

      // try {
      //     if (typeof questions === 'string') {
      //         questions = JSON.parse(questions);
      //     }
      // } catch (parseError) {
      //     await session.abortTransaction();
      //     return next(new ErrorResponse('Invalid questions format', 400));
      // }

      const questionsArray = Array.isArray(questions) ? questions : [questions];
      console.log("questionsArray", questionsArray);
      // const validQuestions = questionsArray
      //     .filter(q => q.index !== null && q.question !== null && q.answers?.length > 0)
      //     .map(q => ({
      //         ...q,
      //         answers: q.answers.filter(a => a.content !== null && a.isCorrect !== null)
      //     }));

      const parsedQuestionsArray = questionsArray.flatMap((q) =>
        typeof q === "string" ? JSON.parse(q) : q
      );

      const validQuestions = parsedQuestionsArray
        .filter(
          (q) =>
            q.index !== null && q.question !== null && q.answers?.length > 0
        )
        .map((q) => ({
          ...q,
          answers: q.answers.filter(
            (a) => a.content !== null && a.isCorrect !== null
          ),
        }));

      console.log("Parsed Questions Array:", parsedQuestionsArray);

      console.log("Array question ", validQuestions);
      const url = `${process.env.MINIO_URL}/${objectName}`;
      const videoData = {
        file: url.toString(),
        duration: req.body.duration,
        questions: validQuestions,
      };

      let moduleItem = await ModuleItem.findById(itemId).session(session);
      if (!moduleItem) {
        await session.abortTransaction();
        return next(
          new ErrorResponse(`No found module item with id ${itemId}`, 404)
        );
      }
      console.log("videoData", videoData);

      const video = await Video.findByIdAndUpdate(
        moduleItem.video,
        {
          $set: {
            file: videoData.file,
            duration: videoData.duration,
            questions: videoData.questions.map((q) => ({
              index: q.index,
              questionType: q.questionType,
              question: q.question,
              startTime: q.startTime,
              answers: q.answers.map((a) => ({
                content: a.content,
                isCorrect: a.isCorrect,
              })),
            })),
          },
        },
        {
          session,
          new: true,
          runValidators: true,
        }
      );
      if (!video) {
        await session.abortTransaction();
        return next(new ErrorResponse(`No found video to update`, 404));
      }

      const updatedModuleItem = await ModuleItem.findByIdAndUpdate(
        itemId,
        {
          $set: {
            title,
            description,
            video: video._id,
          },
        },
        {
          session,
          new: true,
          runValidators: true,
        }
      ).populate("video"); // Populate video data if needed

      if (!updatedModuleItem) {
        await session.abortTransaction();
        return next(new ErrorResponse(`Failed to update module item`, 400));
      }

      await session.commitTransaction();

      return res.status(200).json({
        // Changed to 200 since it's an update
        success: true,
        data: updatedModuleItem,
      });
    } catch (error) {
      console.error("Error starting transaction:", error);
      return next(new ErrorResponse("Error starting transaction", 500));
    } finally {
      session.endSession();
    }
  }
  // If we've exhausted all retries
  return next(
    new ErrorResponse("Failed to edit module item after multiple attempts", 500)
  );
});
export const editQuizByItemId = asyncHandler(async (req, res, next) => {
  const itemId = req.params.itemId;
  const quizData = req.body;
  if (!quizData || !quizData.questions || !Array.isArray(quizData.questions)) {
    return next(
      new ErrorResponse(
        "Please provide valid quiz data with questions array",
        400
      )
    );
  }
  console.log("quiz data:", req.body, itemId);
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const moduleItem = await ModuleItem.findById(itemId).session(session);
    if (!moduleItem) {
      await session.abortTransaction();
      return next(
        new ErrorResponse(`No found module item with id ${itemId}`, 404)
      );
    }

    const quiz = await Quiz.findByIdAndUpdate(
      moduleItem.quiz,
      {
        $set: {
          moduleItem: moduleItem._id,
          duration: quizData.duration,
          passingScore: quizData.passingScore,
          questions: quizData.questions.map((q) => ({
            orderNumber: q.orderNumber,
            content: q.content,
            type: q.type,
            points: q.points,
            answers: q.answers.map((a) => ({
              content: a.content,
              isCorrect: a.isCorrect,
            })),
            explanation: q.explanation,
          })),
        },
      },
      {
        session,
        new: true,
        runValidators: true,
      }
    );

    if (!quiz) {
      await session.abortTransaction();
      return next(new ErrorResponse(`No found quiz to update`, 404));
    }

    const updatedModuleItem = await ModuleItem.findByIdAndUpdate(
      itemId,
      {
        $set: {
          title: quizData.title,
          description: quizData.description,
          type: quizData.type,
          contentType: quizData.contentType,
          icon: quizData.icon,
          isGrade: quizData.isGrade,
          quiz: quiz._id,
        },
      },
      { session, new: true, runValidators: true }
    ).populate("quiz");

    if (!updatedModuleItem) {
      await session.abortTransaction();
      return next(new ErrorResponse(`Failed to update module item`, 400));
    }

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      data: updatedModuleItem,
    });
  } catch (error) {
    console.error("Error updating quiz:", error);
    return next(new ErrorResponse("Error updating quiz", 500));
  } finally {
    session.endSession();
  }
});

export const editProgrammingByItemId = asyncHandler(async (req, res, next) => {
  const itemId = req.params.itemId;
  const programData = req.body;
  if (!programData) {
    return next(
      new ErrorResponse("Please provide valid programming data", 400)
    );
  }
  console.log("Edit Programming", itemId, programData);
  const session = await mongoose.startSession();
  try {
    const moduleItem = await ModuleItem.findById(itemId);
    if (!moduleItem) {
      return next(
        new ErrorResponse(`No found module item with id ${itemId}`, 404)
      );
    }
    await session.startTransaction();
    const program = await ProgramProblem.findByIdAndUpdate(
      moduleItem.programming,
      {
        $set: {
          problemName: programData.programming.problemName,
          content: programData.programming.content,
          difficulty: programData.programming.difficulty,
          tags: programData.programming.tags,
          constraints: programData.programming.constraints,
          inputFormat: programData.programming.inputFormat,
          outputFormat: programData.programming.outputFormat,
          sampleInput: programData.programming.sampleInput,
          sampleOutput: programData.programming.sampleOutput,
          explanation: programData.programming.explanation,
          editorial: programData.programming.editorial,
          testcases: programData.programming.testcases,
          createdBy: req.user.id,
          baseScore: programData.programming.baseScore,
          timeBonus: programData.programming.timeBonus,
          memoryBonus: programData.programming.memoryBonus,
          codeFormat: programData.programming.codeFormat,
        },
      },
      {
        session,
        new: true,
        runValidators: true,
      }
    );

    if (!program) {
      await session.abortTransaction();
      return next(new ErrorResponse(`No found program to update`, 404));
    }

    const updatedModuleItem = await ModuleItem.findByIdAndUpdate(
      itemId,
      {
        $set: {
          title: programData.title,
          description: programData.description,
          type: programData.type,
          contentType: programData.contentType,
          icon: programData.icon,
          isGrade: programData.isGrade,
          programming: program._id,
        },
      },
      {
        session,
        new: true,
        runValidators: true,
      }
    ).populate("programming");

    if (!updatedModuleItem) {
      await session.abortTransaction();
      return next(new ErrorResponse(`Failed to update module item`, 400));
    }

    await session.commitTransaction();
    console.log("Updated Module Item", updatedModuleItem);
    return res.status(200).json({
      success: true,
      data: updatedModuleItem,
    });
  } catch (err) {
    console.error("Error updating programming:", error);
    return next(new ErrorResponse("Error updating programming", 500));
  } finally {
    session.endSession();
  }
});


function generatePrompt(currQuestion, selectedAnswer, historyAns) {
  // Extract question information
  const { question, questionType, answers } = currQuestion;

  // Get the correct answer
  const correctAnswer =
    answers.find((ans) => ans.isCorrect)?.content || "Undefined answer";

  // Get the list of incorrect answers, formatted as bullet points
  const incorrectAnswers = answers
    .filter((ans) => !ans.isCorrect)
    .map((ans) => `- "${ans.content}"`)
    .join("\n");

  // Get the answer that the user selected
  const selectedAnswerText =
    answers.find((ans) => ans._id === selectedAnswer[0])?.content ||
    "Undefined answer";

  // Check if the selected answer is correct
  const isSelectedCorrect =
    answers.find((ans) => ans._id === selectedAnswer[0])?.isCorrect || false;
  const correctnessMsg = isSelectedCorrect ? "**correct**" : "**incorrect**";

  // Construct the prompt with clear sections and instructions
  return `

  As a programming instructor, create a new multiple-choice question in the "${questionType}" format.

The new question should be similar in content to the following:
"${question}"

Additional information:
- Correct answer in the original question: "${correctAnswer}"
- Incorrect answers in the original question:
${incorrectAnswers}

The user selected: "${selectedAnswerText}", but this answer is ${correctnessMsg}.

The history answer for this question is:
${JSON.stringify(historyAns, null, 2)}

Please generate a new question that tests knowledge on the same topic but uses a different context or rephrased wording.
The new question should maintain these characteristics:
${JSON.stringify(currQuestion, null, 2)}

Ensure the new question:
1. Tests the same programming concept in a different way
2. Is not too similar to any questions in the history
3. Maintains the appropriate difficulty level
4. Includes clear explanations for both correct and incorrect answers`;
}

// function generatePrompt(currQuestion, selectedAnswer, historyAns) {
//   // Extract question information
//   const { question, questionType, answers } = currQuestion;

//   // Get the correct answer
//   const correctAnswer =
//     answers.find((ans) => ans.isCorrect)?.content || "Undefined answer";

//   // Get the list of incorrect answers, formatted as bullet points
//   const incorrectAnswers = answers
//     .filter((ans) => !ans.isCorrect)
//     .map((ans) => `- "${ans.content}"`)
//     .join("\n");

//   // Get the answer that the user selected
//   const selectedAnswerText =
//     answers.find((ans) => ans._id === selectedAnswer[0])?.content ||
//     "Undefined answer";

//   // Check if the selected answer is correct
//   const isSelectedCorrect =
//     answers.find((ans) => ans._id === selectedAnswer[0])?.isCorrect || false;
//   const correctnessMsg = isSelectedCorrect ? "**correct**" : "**incorrect**";

//   // Construct the system and user messages
//   return [

//     {
//       role: "user",
//       content: `
// Create a new question in the "${questionType}" format, similar in content to the following question:
// "${question}"

// Additional information:
// - Correct answer in the original question: "${correctAnswer}"
// - Incorrect answers in the original question:
// ${incorrectAnswers}
// - The user selected: "${selectedAnswerText}", which is ${correctnessMsg}.
// - Answer history: ${JSON.stringify(historyAns, null, 2)}
// - Original question characteristics: ${JSON.stringify(currQuestion, null, 2)}

// Ensure the new question:
// 1. Tests the same programming concept in a different way.
// 2. Is not too similar to any questions in the history.
// 3. Maintains the appropriate difficulty level.
// 4. Includes clear explanations for both correct and incorrect answers.
//       `,
//     },
//   ];
// }

// export const updateInteractiveQuestion = asyncHandler(
//   async (req, res, next) => {
//     const { currentQuestion, selectedAnswer, status, videoId } = req.body;
//     console.log("currentQuestion", currentQuestion);
//     console.log("selectedAnswer", selectedAnswer);
//     console.log("videoId", videoId);
//     console.log("status", status);
//     const userId = req.user.id;
//     const moduleItemId = req.params.itemId;

//     if (!currentQuestion) {
//       return next(new ErrorResponse("Please provide valid question data", 400));
//     }
//     if (!moduleItemId) {
//       return next(new ErrorResponse("Please provide moduleItemId", 400));
//     }
//     if (!selectedAnswer) {
//       return next(new ErrorResponse("Please provide selectedAnswer", 400));
//     }

//     const moduleItem = await ModuleItem.findById(moduleItemId);
//     if (!moduleItem) {
//       return res.status(404).json({ message: "Module item not found" });
//     }

//     const historyAns = currentQuestion.history
//       .filter((ans) => ans.userId.toString() === userId.toString())
//       .map((ans) => ({
//         question: ans.question,
//         answer: ans.answer,
//         isCorrect: ans.isCorrect,
//       }));

//     console.log("historyAns", historyAns);
//     console.log("status", status);

//     // Update the history answer
//     if (status === "correct") {
//       await updateHistoryAnswer(
//         currentQuestion,
//         videoId,
//         selectedAnswer,
//         true,
//         userId
//       );
//     } else if (status === "incorrect") {
//       await updateHistoryAnswer(
//         currentQuestion,
//         videoId,
//         selectedAnswer,
//         false,
//         userId
//       );
//       await createNewInteractiveQuestion(
//         currentQuestion,
//         selectedAnswer,
//         videoId,
//         userId
//       );
//     }
//     // return res.status(200).json({
//     //   success: true,
//     //   data: formatResponse,
//     // });
//   }
// );

// export const preloadInteractiveQuestion = asyncHandler(
//   async (req, res, next) => {
//     const videoId = req.params.videoId;
//     const userId = req.user.id;

//     if (!videoId) {
//       return next(new ErrorResponse("Please provide videoId", 400));
//     }

//     const video = await Video.findById(videoId);
//     if (!video) {
//       return res.status(404).json({ message: "Video not found" });
//     }

//     // Kiểm tra nếu người dùng đã có bất kỳ lịch sử nào trên video này
//     const hasHistory = video.questions.some((q) =>
//       q.history.some((h) => h.userId.toString() === userId)
//     );

//     if (hasHistory) {
//       return res
//         .status(200)
//         .json({ success: true, message: "User already has question history" });
//     }

//     // Nếu chưa có → tạo câu hỏi dự phòng cho tất cả câu hỏi gốc
//     for (const question of video.questions) {
//       const historyAns = []; // Vì người dùng chưa từng trả lời => history trống
//       const prompt = generatePrompt(question, historyAns);
//       const result = await GeminiAI(prompt);
//       if (result.error) {
//         console.error("AI error:", result.error);
//         continue; // bỏ qua nếu có lỗi AI
//       }

//       const aiQ = processAIResponse(result, question._id);

//       question.history.push({
//         userId,
//         question: aiQ.question,
//         answers: aiQ.answers,
//         selectedAnswer: [],
//         isCorrect: false,
//         timestamp: new Date(),
//         status: "not-started",
//       });
//     }

//     await video.save();

//     res.status(200).json({
//       success: true,
//       message: "Preloaded questions created successfully",
//     });
//   }
// );

// Tạo câu hỏi tương tác mới khi trả lời sai
export async function createNewInteractiveQuestion(
  currQuestion,
  videoId,
  userId,
  selectedAnswer
) {
  const video = await Video.findById(videoId);
  console.log("video create", videoId);
  if (!video) throw new Error("Video not found " + videoId);

  const question = video.questions.id(currQuestion._id);
  if (!question) throw new Error("Question not found");

  // Lấy lịch sử trả lời của user này
  const historyAns = question.history
    .filter((ans) => ans.userId.toString() === userId.toString())
    .map((ans) => ({
      question: ans.question,
      selectedAnswer: ans.selectedAnswer, // Sửa từ 'answer' thành 'selectedAnswer'
      isCorrect: ans.isCorrect,
    }));

  const prompt = generatePrompt(currQuestion, selectedAnswer, historyAns);
  const result = await GeminiAI(prompt);
  console.log("AI result:", result);

  if (result.error) {
    throw new Error(result.error); // Throw error thay vì return response
  }

  const quesId = currQuestion._id;
  const aiResponse = processAIResponse(result, quesId);
  console.log("formatResponse", aiResponse);

  // Thêm câu hỏi mới vào lịch sử với status 'not-started'
  question.history.push({
    userId,
    question: aiResponse.question,
    answers: aiResponse.answers,
    selectedAnswer: [],
    isCorrect: false,
    status: "unanswered",
    timestamp: new Date(),
  });

  await video.save();
  return aiResponse; // Return câu hỏi mới được tạo
}

// Tạo lịch sử trả lời mới
async function createAnswerHistory(
  currQuestion,
  videoId,
  selectedAnswer,
  isCorrect,
  userId
) {
  const video = await Video.findById(videoId);
  if (!video) throw new Error("Video not found");

  const question = video.questions.id(currQuestion._id);
  if (!question) throw new Error("Question not found");

  // Lấy nội dung selectedAnswer (chuyển từ ID sang content)
  const selectedAnswersContent = currQuestion.answers
    .filter((ans) =>
      selectedAnswer.includes(ans._id?.toString() || ans.content)
    )
    .map((ans) => ans.content);

  // Tìm entry trong history của user đó và đúng question
  const existingEntry = question.history.find(
    (entry) =>
      entry.userId.toString() === userId.toString() &&
      entry.question === currQuestion.question
  );

  if (existingEntry) {
    // ✅ Nếu đã tồn tại → cập nhật entry đó
    existingEntry.selectedAnswer = selectedAnswersContent;
    existingEntry.isCorrect = isCorrect;
    existingEntry.timestamp = new Date();
    existingEntry.status = isCorrect ? "completed" : "in-progress";
  } else {
    // ✅ Nếu chưa có → tạo mới
    const newHistoryEntry = {
      userId: userId,
      question: currQuestion.question,
      answers: currQuestion.answers.map((ans) => ({
        content: ans.content,
        isCorrect: ans.isCorrect,
      })),
      selectedAnswer: selectedAnswersContent,
      isCorrect: isCorrect,
      timestamp: new Date(),
      status: isCorrect ? "completed" : "in-progress",
    };

    question.history.push(newHistoryEntry);
  }

  await video.save();

  return { success: true };
}


// Controller chính
export const updateInteractiveQuestion = asyncHandler(
  async (req, res, next) => {
    const { currentQuestion, selectedAnswer, status, videoId } = req.body;
    console.log("currentQuestion", currentQuestion);
    console.log("selectedAnswer", selectedAnswer);
    console.log("videoId", videoId);
    console.log("status", status);


    const userId = req.user.id;
    const moduleItemId = req.params.itemId;

    // Validation
    if (!currentQuestion) {
      return next(new ErrorResponse("Please provide valid question data", 400));
    }
    if (!moduleItemId) {
      return next(new ErrorResponse("Please provide moduleItemId", 400));
    }
    if (!selectedAnswer || selectedAnswer.length === 0) {
      return next(new ErrorResponse("Please provide selectedAnswer", 400));
    }

    const moduleItem = await ModuleItem.findById(moduleItemId);
    if (!moduleItem) {
      return res.status(404).json({ message: "Module item not found" });
    }

    try {
      let nextQuestion = null;

      if (status === "correct") {
        // Trả lời đúng -> cập nhật lịch sử và kết thúc
        await createAnswerHistory(
          currentQuestion,
          videoId,
          selectedAnswer,
          true,
          userId
        );

        console.log(`User ${userId} answered correctly. Ending question flow.`);

        return res.status(200).json({
          success: true,
          message: "Question answered correctly",
          data: {
            isCorrect: true,
            nextQuestion: null,
          },
        });
      } else if (status === "incorrect") {
        // Trả lời sai -> cập nhật lịch sử
        await createAnswerHistory(
          currentQuestion,
          videoId,
          selectedAnswer,
          false,
          userId
        );

        console.log(
          `User ${userId} answered incorrectly. Checking for existing not-started questions...`
        );

        // Kiểm tra trong lịch sử có câu hỏi nào ở trạng thái not-started không
        const existingQuestion = await findExistingNotStartedQuestion(
          videoId,
          userId,
          currentQuestion.questionId || currentQuestion._id
        );

        if (existingQuestion) {
          // Có câu hỏi not-started trong lịch sử -> sử dụng lại
          console.log(
            "Found existing not-started question:",
            existingQuestion
          );
          nextQuestion = existingQuestion;
        } else {
          // Không có câu hỏi not-started -> tạo câu hỏi mới
          console.log(
            "No existing not-started question found, creating new one"
          );
          nextQuestion = await createNewInteractiveQuestion(
            currentQuestion,
            videoId,
            userId,
            selectedAnswer
          );
        }

        return res.status(200).json({
          success: true,
          message: existingQuestion
            ? "Question answered incorrectly, existing question retrieved"
            : "Question answered incorrectly, new question generated",
          data: {
            isCorrect: false,
            nextQuestion: nextQuestion,
          },
        });
      }
    } catch (error) {
      console.error("Error in updateInteractiveQuestion:", error);
      return next(new ErrorResponse(error.message, 500));
    }
  }
);

// Helper function để tìm câu hỏi not-started trong lịch sử
const findExistingNotStartedQuestion = async (
  videoId,
  userId,
  currentQuestionId
) => {
  try {
    const video = await Video.findById(videoId);
    if (!video) {
      throw new Error("Video not found");
    }

    // Tìm question gốc hiện tại
    const currentOriginalQuestion = video.questions.find(
      (q) => q._id.toString() === currentQuestionId.toString()
    );

    if (!currentOriginalQuestion) {
      throw new Error("Current question not found");
    }

    // Tìm trong lịch sử của question này có câu hỏi nào unanswered không
    const notStartedHistory = currentOriginalQuestion.history.find(
      (h) => h.userId.toString() === userId && h.status === "unanswered"
    );

    if (notStartedHistory) {
      console.log(
        "Found unanswered question in history:",
        notStartedHistory
      );
      return {
        questionId: currentOriginalQuestion._id,
        originalQuestion: currentOriginalQuestion,
        currentQuestion: notStartedHistory,
        status: notStartedHistory.status,
      };
    }

    return null;
  } catch (error) {
    console.error("Error in findExistingNotStartedQuestion:", error);
    throw error;
  }
};

// Alternative: Nếu bạn muốn kiểm tra across tất cả questions của video
const findExistingNotStartedQuestionAcrossAllQuestions = async (
  videoId,
  userId
) => {
  try {
    const video = await Video.findById(videoId);
    if (!video) {
      throw new Error("Video not found");
    }

    // Duyệt qua tất cả questions trong video
    for (const question of video.questions) {
      const notStartedHistory = question.history.find(
        (h) => h.userId.toString() === userId && h.status === "not-started"
      );

      if (notStartedHistory) {
        console.log(
          "Found not-started question across all questions:",
          notStartedHistory._id
        );
        return {
          questionId: question._id,
          originalQuestion: question,
          currentQuestion: notStartedHistory,
          status: notStartedHistory.status,
        };
      }
    }

    return null;
  } catch (error) {
    console.error(
      "Error in findExistingNotStartedQuestionAcrossAllQuestions:",
      error
    );
    throw error;
  }
};

// Preload câu hỏi khi mở video
export const preloadInteractiveQuestion = asyncHandler(
  async (req, res, next) => {
    const videoId = req.params.videoId;
    const userId = req.user.id;
    //console.log("Preloading questions for videoId:", videoId);
    if (!videoId) {
      return next(new ErrorResponse("Please provide videoId", 400));
    }

    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    // Kiểm tra nếu người dùng đã có lịch sử trả lời
    const hasHistory = video.questions.some((q) =>
      q.history.some((h) => h.userId.toString() === userId)
    );
    //console.log("User has history:", hasHistory);

    if (hasHistory) {
      // Trả về câu hỏi hiện tại của user (nếu có câu hỏi chưa hoàn thành)
      const userQuestions = [];

      for (const question of video.questions) {
        const userHistory = question.history.find(
          (h) =>
            h.userId.toString() === userId &&
            (h.status === "not-started" || h.status === "in-progress")
        );

        if (userHistory) {
          userQuestions.push({
            questionId: question._id,
            originalQuestion: question,
            currentQuestion: userHistory,
            status: userHistory.status,
          });
        }
      }
      //console.log("User questions:", userQuestions);
      return res.status(200).json({
        success: true,
        message: "User has existing question history",
        data: userQuestions,
      });
    }

    // Nếu chưa có lịch sử -> tạo câu hỏi ban đầu cho tất cả câu hỏi gốc
    try {
      const preloadedQuestions = [];

      for (const question of video.questions) {
        const historyAns = []; // Người dùng chưa từng trả lời
        //console.log("Generating prompt for question:", question._id);
        //console.log("quéstion", question);
        const prompt = generatePrompt(question, [], historyAns);
        //console.log("Prompt for AI:", question._id, "---", prompt);
        const result = await GeminiAI(prompt);
        //console.log("AI result for question:", question._id, ":", result);
        if (result.error) {
          console.error(
            "AI error for question",
            question._id,
            ":",
            result.error
          );
          continue;
        }

        try {
          // Process AI response trước
          const aiResponse = processAIResponse(result, question._id);
          console.log(
            "Processed AI response for question:",
            question._id,
            ":",
            aiResponse.question
          );
          // Atomic update
          const result11 = await Video.findOneAndUpdate(
            {
              _id: videoId,
              "questions._id": question._id,
            },
            {
              $push: {
                "questions.$.history": {
                  userId,
                  question: aiResponse.question,
                  answers: aiResponse.answers,
                  selectedAnswer: [],
                  isCorrect: false,
                  timestamp: new Date(),
                  status: "unanswered",
                },
              },
            },
            {
              new: true,
              runValidators: true,
            }
          );
          preloadedQuestions.push({
            questionId: question._id,
            originalQuestion: question,
            currentQuestion: aiResponse,
            status: "unanswered",
          });

          if (!result11) {
            throw new Error("Document or question not found");
          }

          console.log("Successfully updated document");
          return result11;
        } catch (error) {
          console.error("Error in preloadInteractiveQuestion:", error);
          throw error;
        }
      }

      await video.save();
      // Trả về danh sách câu hỏi đã preload
      console.log("Preloaded questions:", preloadedQuestions);
      const ques = await Video.findById(videoId).populate("questions.history.userId");
      if (!ques) {
        return next(new ErrorResponse("No questions found for this video", 404));
      }
      console.log("Preloaded questions:", ques.questions);
      res.status(200).json({
        success: true,
        message: "Preloaded questions created successfully",
        data: ques,
      });
    } catch (error) {
      console.error("Error in preloadInteractiveQuestion:", error);
      return next(new ErrorResponse(error.message, 500));
    }
  }
);

// Helper function: Lấy câu hỏi hiện tại của user
export const getCurrentUserQuestion = asyncHandler(async (req, res, next) => {
  const { videoId, questionId } = req.params;
  const userId = req.user.id;

  const video = await Video.findById(videoId);
  if (!video) {
    return res.status(404).json({ message: "Video not found" });
  }

  const question = video.questions.id(questionId);
  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  // Tìm câu hỏi hiện tại của user (chưa hoàn thành)
  const currentUserQuestion = question.history.find(
    (h) =>

      h.userId.toString() === userId &&
      (h.status === "not-started" || h.status === "in-progress")
  );

  if (!currentUserQuestion) {
    return res.status(404).json({
      message: "No active question found for this user",
    });
  }

  res.status(200).json({
    success: true,
    data: {
      questionId: question._id,
      originalQuestion: question,
      currentQuestion: currentUserQuestion,
      status: currentUserQuestion.status,
    },
  });
});
