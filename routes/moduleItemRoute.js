import express from "express";
import quizController from "../controllers/quizController.js";
// import videoController from "../controllers/videoController.js";
import { isLoggedin } from "../middlewares/isLoggedin.js";
import { authorize, protect } from "../middlewares/auth.js";
import upload from "../middlewares/upload.js";
import { getModuleById } from "../controllers/moduleController.js"
import { editLectureByItemId, editProgrammingByItemId, editQuizByItemId, editSupplementByItemId } from "../controllers/moduleItemController.js";

const router = express.Router();

router.route('/supplement/:itemId')
    .put(
        protect,
        authorize('instructor', 'admin'),
        upload.single('file'),
        editSupplementByItemId);

router.route('/lecture/:itemId')
    .put(protect,
        authorize('instructor', 'admin'),
        upload.single('file'),
        editLectureByItemId);


router.route('/quiz/:itemId')
    .put(
        protect,
        authorize('instructor', 'admin'),
        editQuizByItemId);

router.route('/programming/:itemId')
    .put(
        protect,
        authorize('instructor', 'admin'),
        editProgrammingByItemId);


export default router;
