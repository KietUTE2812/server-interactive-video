import express from "express";
import paymentCtrl from "../controllers/paymentController.js";
import { isLoggedin } from "../middlewares/isLoggedin.js";

const payRouter = express.Router();

payRouter.post("/create-payment", paymentCtrl.createPayment);
payRouter.get("/vnpay-return", paymentCtrl.vnpayReturn);
payRouter.get("/vnpay-ipn", paymentCtrl.vnPayIPN);
payRouter.get("/", paymentCtrl.getPayments);
payRouter.get("/user/:userId", paymentCtrl.getPaymentsByUserId);
payRouter.get("/:id", paymentCtrl.getPaymentById);

export default payRouter;