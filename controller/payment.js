const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
});

// Create Razorpay Order
router.post(
  "/razorpay-checkout",
  catchAsyncErrors(async (req, res, next) => {
    const { amount } = req.body;

    if (!amount || isNaN(amount)) {
      return next(new ErrorHandler("Invalid amount", 400));
    }

    const options = {
      amount: Math.round(amount),
      currency: "INR",
      receipt: `receipt_order_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.status(200).json(order);
  })
);

// Send Razorpay Key
router.get(
  "/get-razorpay-key",
  catchAsyncErrors(async (req, res, next) => {
    res.status(200).json({ key: process.env.RAZORPAY_KEY_ID });
  })
);

module.exports = router;
