import express from "express";
import userCtrl from "../controllers/userController.js";
import { isLoggedin } from "../middlewares/isLoggedin.js";
import { verifyToken } from "../utils/verifyToken.js";
import upload from "../config/fileUpload.js";

const userRoutes = express.Router();

userRoutes.post('/auth-google', userCtrl.googleLoginCtrl);
userRoutes.post('/register', userCtrl.registerUserCtrl);//register
userRoutes.post('/login', userCtrl.loginUserCtrl);
// userRoutes.get('/profile',isLoggedin, userCtrl.getUserProfileCtrl);
userRoutes.post('/logout', userCtrl.logoutCtrl);
userRoutes.get('/:userid',isLoggedin, userCtrl.getUserProfileCtrl);
userRoutes.put('/:userid/', isLoggedin, upload.single('avatar'), userCtrl.updateUserCtrl);//update user profile
userRoutes.post('/forgot-password', userCtrl.forgotPasswordCtrl);
userRoutes.post('/reset-password', userCtrl.resetPasswordCtrl);
userRoutes.delete('/:userid', isLoggedin, userCtrl.deleteUserCtrl);
userRoutes.post('/reset-access-token', userCtrl.refreshAccessTokenCtrl);
userRoutes.post('/verify-account', userCtrl.verifyAccountCtrl);
export default userRoutes   