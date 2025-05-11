import express from "express";
import userCtrl from "../controllers/userController.js";
import { isLoggedin } from "../middlewares/isLoggedin.js";
import { verifyToken } from "../utils/verifyToken.js";
import upload from "../config/fileUpload.js";
import { protect, authorize } from "../middlewares/auth.js";
import isAdmin from "../middlewares/isAdmin.js";
import { checkAuth, verifyPassword } from "../controllers/authController.js";

const userRoutes = express.Router();

// Middleware để kiểm tra quyền truy cập thông tin người dùng
// Cho phép admin hoặc chính người dùng đó truy cập
const authorizeUserAccess = (req, res, next) => {
  const requestedUserId = req.params.userid;
  const currentUserId = req.user._id.toString();
  
  // Nếu người dùng là admin hoặc chính họ truy cập thông tin của mình
  if (req.user.role === 'admin' || currentUserId === requestedUserId) {
    return next();
  }
  
  return res.status(403).json({
    status: "error",
    message: "You are not authorized to access this information"
  });
};

// ===== PUBLIC ROUTES =====
userRoutes.post('/register', userCtrl.registerUserCtrl);
userRoutes.post('/login', userCtrl.loginUserCtrl);
userRoutes.post('/forgot-password', userCtrl.forgotPasswordCtrl);
userRoutes.post('/reset-password', userCtrl.resetPasswordCtrl);
userRoutes.post('/verify-account', userCtrl.verifyAccountCtrl);
userRoutes.post('/reset-access-token', userCtrl.refreshAccessTokenCtrl);

// ===== AUTHENTICATED ROUTES =====
// Kiểm tra tình trạng xác thực
userRoutes.get('/check-auth', protect, checkAuth);

// Đăng xuất (yêu cầu đăng nhập)
userRoutes.post('/logout', protect, userCtrl.logoutCtrl);

// ===== USER PROFILE ROUTES =====
// Lấy thông tin cá nhân - chỉ admin hoặc chính người dùng đó
userRoutes.get('/:userid', protect, authorizeUserAccess, userCtrl.getUserProfileCtrl);

// Cập nhật thông tin cá nhân - chỉ admin hoặc chính người dùng đó
userRoutes.put('/:userid', 
  protect, 
  authorizeUserAccess, 
  upload.uploadCloudinary.single('avatar'), 
  userCtrl.updateUserCtrl
);

// Xóa tài khoản - chỉ admin hoặc chính người dùng đó
userRoutes.delete('/:userid', 
  protect, 
  authorizeUserAccess, 
  userCtrl.deleteUserCtrl
);

// ===== ADMIN ROUTES =====
// Lấy danh sách tất cả người dùng - chỉ admin
userRoutes.get('/', 
  protect, 
  authorize('admin'), 
  userCtrl.getAllUserCtrl
);

// Cập nhật thông tin người dùng bởi admin - chỉ admin
userRoutes.put('/update-by-admin/:userid', 
  protect, 
  authorize('admin'), 
  upload.uploadCloudinary.single('avatar'), 
  userCtrl.updateUserByAdminCtrl
);

export default userRoutes;