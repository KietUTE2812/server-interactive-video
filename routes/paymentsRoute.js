import express from "express";
import paymentCtrl from "../controllers/paymentController.js";
import { isLoggedin } from "../middlewares/isLoggedin.js";
import { protect, authorize } from "../middlewares/auth.js";

const payRouter = express.Router();

// Public routes for payment processing
payRouter.post("/create-payment", protect, paymentCtrl.createPayment);
payRouter.get("/vnpay-return", protect, paymentCtrl.vnpayReturn);
payRouter.get("/vnpay-ipn", protect, paymentCtrl.vnPayIPN);

// Export payments to excel
payRouter.get("/export", protect, authorize('admin'), paymentCtrl.exportPayments);

// Analytics endpoint - admin only
payRouter.get("/analytics", protect, authorize('admin'), paymentCtrl.getPaymentAnalytics);

// General payment routes with proper authorization 
payRouter.get("/", protect, paymentCtrl.getPayments);
payRouter.get("/user/:userId", protect, paymentCtrl.getPaymentsByUserId);
payRouter.get("/:id", protect, paymentCtrl.getPaymentById);

export default payRouter;