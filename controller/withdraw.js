const Shop = require("../model/shop");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const express = require("express");
const { isSeller, isAuthenticated, isAdmin } = require("../middleware/auth");
const Withdraw = require("../model/withdraw");
const sendMail = require("../utils/sendMail");
const router = express.Router();

// create withdraw request --- only for seller
router.post(
  "/create-withdraw-request",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { amount } = req.body;

      if (!amount || typeof amount !== "number" || amount <= 0) {
        return next(new ErrorHandler("Invalid withdrawal amount", 400));
      }

      const taxRate = 0.18; // 18% service tax
      const serviceCharge = Number((amount * taxRate).toFixed(2));
      const finalAmount = Number((amount - serviceCharge).toFixed(2));

      const shop = await Shop.findById(req.seller._id);

      if (shop.availableBalance < amount) {
        return next(new ErrorHandler("Insufficient balance", 400));
      }

     const withdraw = await Withdraw.create({
  seller: req.seller._id,
  amount: finalAmount,
  serviceCharge,
  withdrawMethod: {
    upiId: shop.withdrawMethod?.upiId || "",
  },
});


      shop.availableBalance = shop.availableBalance - amount;
      await shop.save();

      try {
        await sendMail({
          email: req.seller.email,
          subject: "Withdraw Request",
          message: `Hello ${req.seller.name},\nYour withdraw request of ₹${amount} has been received.\n₹${finalAmount} will be transferred to your bank after ₹${serviceCharge} (18%) service tax.\nProcessing time is 3 to 7 business days.`,
        });
      } catch (error) {
        return next(new ErrorHandler(error.message, 500));
      }

      res.status(201).json({
        success: true,
        withdraw,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// get all withdraws --- admin
router.get(
  "/get-all-withdraw-request",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const withdraws = await Withdraw.find()
  .sort({ createdAt: -1 })
  .populate("seller"); // 👈 This fetches full seller info


      res.status(200).json({
        success: true,
        withdraws,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// update withdraw request ---- admin
// update withdraw request ---- admin
router.put(
  "/update-withdraw-request/:id",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { sellerId, status } = req.body;

      const withdraw = await Withdraw.findByIdAndUpdate(
        req.params.id,
        {
          status: status || "succeed",
          updatedAt: Date.now(),
        },
        { new: true }
      );

      const seller = await Shop.findById(sellerId);
      if (!seller) {
        return next(new ErrorHandler("Seller not found", 404));
      }

      // Deduct the final amount (after service charge) from seller's balance
      if (status === "succeed") {
        seller.availableBalance -= withdraw.amount;  // Deducting the final amount after service charge
        await seller.save();
      }

      const transaction = {
        _id: withdraw._id,
        amount: withdraw.amount,
        serviceCharge: withdraw.serviceCharge,
        finalAmount: withdraw.amount - withdraw.serviceCharge,
        upiId: withdraw.withdrawMethod.upiId,
        updatedAt: withdraw.updatedAt,
        status: withdraw.status,
      };

      seller.transactions = [...(seller.transactions || []), transaction];
      await seller.save();

      try {
        await sendMail({
          email: seller.email,
          subject: "Payment Confirmation",
          message: `Hello ${seller.name},\nYour withdraw of ₹${withdraw.amount} is being processed.\nYou will receive ₹${withdraw.amount - withdraw.serviceCharge} after the service charge of ₹${withdraw.serviceCharge}.\nProcessing time depends on your bank (usually 3 to 7 days).`,
        });
      } catch (error) {
        return next(new ErrorHandler(error.message, 500));
      }

      res.status(200).json({
        success: true,
        withdraw,
        message: `Withdrawal request of ₹${withdraw.amount} is successfully processed.`,
        finalAmount: withdraw.amount - withdraw.serviceCharge, // Final amount after deducting the service charge
        serviceCharge: withdraw.serviceCharge,
        upiId: withdraw.withdrawMethod.upiId, // Send back the UPI ID
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);


module.exports = router;
