// import express from 'express';
// import courseCtrl from '../controllers/courseController.js';
// import { isLoggedin } from '../middlewares/isLoggedin.js';
// import upload from '../config/fileUpload.js';


// const courseRoutes = express.Router();

// courseRoutes.post('/', isLoggedin, upload.single('image'), courseCtrl.createCourse);
// courseRoutes.get('/', courseCtrl.getCourses);
// courseRoutes.get('/:id', courseCtrl.getCourseById);
// courseRoutes.put('/:id', isLoggedin, upload.single('image'), courseCtrl.updateCourse);
// courseRoutes.delete('/:id', isLoggedin, courseCtrl.deleteCourse);
// courseRoutes.get('/student/:id', courseCtrl.getCoursesByStudentId);
// courseRoutes.get('/instructor/:id', courseCtrl.getCoursesByInstructorId);

// export default courseRoutes;