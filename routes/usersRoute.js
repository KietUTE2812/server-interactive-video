import express from "express";
import { forgotPasswordCtrl, getUserProfileCtrl, loginUserCtrl, registerUserCtrl, resetPasswordCtrl, updateUserCtrl, deleteUserCtrl } from "../controllers/userController.js";
import { isLoggedin } from "../middlewares/isLoggedin.js";

const userRoutes = express.Router();

userRoutes.post('/register', registerUserCtrl);
userRoutes.post('/login', loginUserCtrl);
userRoutes.get('/profile', getUserProfileCtrl);
userRoutes.put('/update-profile/', isLoggedin, updateUserCtrl);
userRoutes.post('/forgot-password', isLoggedin, forgotPasswordCtrl);
userRoutes.get('/reset-password/:token', resetPasswordCtrl);
userRoutes.delete('/:userid', isLoggedin, deleteUserCtrl);

export default userRoutes   