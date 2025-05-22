import progressController from "../controllers/progressController.js";
import express from "express";
import { isLoggedin } from "../middlewares/isLoggedin.js";
import { authorize, protect } from "../middlewares/auth.js";

const router = express.Router();

router.route("/").get(isLoggedin, progressController.getProgress);
router
  .route("/:id/video")
  .put(isLoggedin, progressController.updateVideoProgress);
router
  .route("/:id/supplement")
  .put(isLoggedin, progressController.updateSupplementProgress);

router
  .route("/:id/programming")
  .get(
    protect,
    authorize("student"),
    progressController.getProgrammingProgressByProblemId
  )
  .put(
    protect,
    authorize("student"),
    progressController.updateProgrammingProgress
  );
router
  .route(`/:id/grade`)
  .get(protect, authorize("student"), progressController.getGradeByCourseId);
router
  .route(`/moduleItem/:id`)
  .get(protect, authorize("student"), progressController.getModuleItemProgress)

router
  .route(`/module/:id`)
  .get(protect , authorize("student"), progressController.getModuleProgress);
export default router;
