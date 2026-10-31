import { listPayments, createPaymentIntent, confirmPayment } from "../controllers/payments.controller.js";
import { auth, allow } from "@uddeepto/common";
import express from "express";
const router = express.Router();
router.use(auth());
router.get("/", listPayments);
router.post("/intent", createPaymentIntent);
router.post("/:id/confirm", allow("admin"), confirmPayment);
export default router;
