import express from "express";
import userCtrl from "../controllers/userController.js";
import { isLoggedin } from "../middlewares/isLoggedin.js";
import { verifyToken } from "../utils/verifyToken.js";
import upload from "../config/fileUpload.js";
import { protect } from "../middlewares/auth.js";

import isAdmin from "../middlewares/isAdmin.js"
import { checkAuth, verifyPassword } from "../controllers/authController.js";

const userRoutes = express.Router();

userRoutes.post('/auth-google', userCtrl.googleLoginCtrl);
userRoutes.post('/register', userCtrl.registerUserCtrl);//register
userRoutes.post('/login', userCtrl.loginUserCtrl);
// userRoutes.get('/profile',isLoggedin, userCtrl.getUserProfileCtrl);
userRoutes.post('/logout', userCtrl.logoutCtrl);
userRoutes.post('/forgot-password', userCtrl.forgotPasswordCtrl);
userRoutes.post('/reset-password', userCtrl.resetPasswordCtrl);
userRoutes.delete('/:userid', isLoggedin, userCtrl.deleteUserCtrl);
userRoutes.post('/reset-access-token', userCtrl.refreshAccessTokenCtrl); 
userRoutes.post('/verify-account', userCtrl.verifyAccountCtrl);

userRoutes.get('/check-auth', protect, checkAuth);
userRoutes.put('/:userid', isLoggedin, upload.single('avatar'), userCtrl.updateUserCtrl);//update user profile
userRoutes.get('/:userid', isLoggedin, userCtrl.getUserProfileCtrl);
userRoutes.get('/', isAdmin, isLoggedin , userCtrl.getAllUserCtrl);
userRoutes.put('/update-by-admin/:userid', isLoggedin, isAdmin, userCtrl.updateUserByAdminCtrl)// update user by admin
// userRoutes.route('/check-auth-status')
//     .get(protect, userCtrl.checkAuthStatus)
export default userRoutes   