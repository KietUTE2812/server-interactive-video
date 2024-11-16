import express from "express";
import quizController from "../controllers/quizController.js";
import {isLoggedin} from "../middlewares/isLoggedin.js";
import {authorize} from "../middlewares/auth.js";


const router = express.Router();

router.get('/',isLoggedin, quizController.getQuizzes);
router.get('/:id',isLoggedin, quizController.getQuizById);
router.post('/',isLoggedin,authorize('admin', 'instructor'), quizController.createQuiz);
router.put('/:id',isLoggedin,authorize('admin', 'instructor'), quizController.updateQuiz);
router.delete('/:id',isLoggedin,authorize('admin', 'instructor'), quizController.deleteQuiz);
router.post('/:id/answer',isLoggedin, quizController.answerQuiz);
export default router;