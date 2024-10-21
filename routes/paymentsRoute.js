import express from "express";
import paymentCtrl from "../controllers/paymentController.js";
import { isLoggedin } from "../middlewares/isLoggedin.js";

const payRouter = express.Router();

payRouter.post("/create-payment", paymentCtrl.createPayment);
payRouter.get("/vnpay-return", paymentCtrl.vnpayReturn);
payRouter.get("/vnpay-ipn", paymentCtrl.vnPayIPN);

export default payRouter;