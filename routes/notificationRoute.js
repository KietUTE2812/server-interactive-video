import notificationController from "../controllers/notificationController.js";
import express from "express";
import {isLoggedin} from "../middlewares/isLoggedin.js";
import {authorize} from "../middlewares/auth.js";

const router = express.Router();

router.route("/").get(isLoggedin, notificationController.getNotifications);
router.route("/").post( notificationController.createNotification);
// router.route("/:id").get(isLoggedin, notificationController.getNotification);
// router.route("/:id").delete(isLoggedin, notificationController.deleteNotification);
router.route("/:id").put(isLoggedin, notificationController.updateNotification);

export default router;