import axios from 'axios';
import quiz from '../models/Quiz.js';
import asyncHandler from "../middlewares/asyncHandler";
import ErrorResponse from "../utils/ErrorResponse";

// @desc      Get all quiz
// @route     GET /api/v1/course/:id/quiz
// @access    Public
