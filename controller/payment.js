const express = require("express");
const router = express.Router();
const catchAsyncErrors = require("../middleware/catchAsyncErrors");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
//const Razorpay = require("razorpay");

//const razorpay = new Razorpay({
//  key_id: process.env.RAZORPAY_KEY_ID,
//  key_secret: process.env.RAZORPAY_SECRET,
//});

// Stripe payment
router.post(
  "/process",
  catchAsyncErrors(async (req, res, next) => {
    const myPayment = await stripe.paymentIntents.create({
      amount: req.body.amount,
      currency: "INR",
      metadata: {
        company: "dkprivatelimited21",
      },
    });
    res.status(200).json({
      success: true,
      client_secret: myPayment.client_secret,
    });
  })
);

// Stripe API key
router.get(
  "/stripeapikey",
  catchAsyncErrors(async (req, res, next) => {
    res.status(200).json({ stripeApikey: process.env.STRIPE_API_KEY });
  })
);

// Razorpay order route
//router.post(
//  "/razorpay-checkout",
//  catchAsyncErrors(async (req, res) => {
//    const options = {
 //     amount: req.body.amount,
//      currency: "INR",
//      receipt: `receipt_order_${Date.now()}`,
//    };

 //   const order = await razorpay.orders.create(options);
 //   res.status(200).json(order);
//  })
//);

module.exports = router;
