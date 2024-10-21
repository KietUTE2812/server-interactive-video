import express from "express";
import {
    createLivestream,
    getLivestream
} from "../controllers/livestreamController.js";
import { isLoggedin } from "../middlewares/isLoggedin.js";

const streamRoute = express.Router();

streamRoute.post("/",isLoggedin, createLivestream);
streamRoute.get("/:id", getLivestream);

export default streamRoute;