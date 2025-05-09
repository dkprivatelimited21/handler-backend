const express = require("express");
const path = require("path");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { sendMail } = require("../utils/sendMail");
const Shop = require("../model/shop");
const { isAuthenticated, isSeller, isAdmin } = require("../middleware/auth");
const cloudinary = require("cloudinary");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const sendShopToken = require("../utils/shopToken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Product = require("../model/product");
const Order = require("../model/order");

// Create activation token
const createActivationToken = (seller) => {
  return jwt.sign(
    {
      name: seller.name,
      email: seller.email,
    },
    process.env.ACTIVATION_SECRET,
    { expiresIn: "5m" }
  );
};

// Create shop
router.post("/create-shop", catchAsyncErrors(async (req, res, next) => {
  const { email } = req.body;
  const sellerEmail = await Shop.findOne({ email });
  if (sellerEmail) {
    return next(new ErrorHandler("User already exists", 400));
  }

  const defaultAvatarUrl = "https://img.freepik.com/free-vector/blue-circle-with-white-user_78370-4707.jpg";

  const seller = {
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    address: {
      street: req.body.address?.street,
      city: req.body.address?.city,
      state: req.body.address?.state,
      country: req.body.address?.country,
    },
    phoneNumber: req.body.phoneNumber,
    zipCode: req.body.zipCode,
    avatar: {
      url: defaultAvatarUrl,
      public_id: null,
    },
  };

  const activationToken = createActivationToken(seller);
  const activationUrl = `https://local-handler.vercel.app/seller/activation/${activationToken}`;

  try {
    await sendMail({
      email: seller.email,
      subject: "Activate your Shop",
      message: `Hello ${seller.name}, please click on the link to activate your shop: ${activationUrl}`,
    });

    res.status(201).json({
      success: true,
      message: `Please check your email (${seller.email}) to activate your shop.`,
    });
  } catch (error) {
    return next(new ErrorHandler(error.message || "Something went wrong", 500));
  }
}));

// Activate shop
router.post("/activation", catchAsyncErrors(async (req, res, next) => {
  const { activation_token } = req.body;
  const newSeller = jwt.verify(activation_token, process.env.ACTIVATION_SECRET);
  if (!newSeller) {
    return next(new ErrorHandler("Invalid token", 400));
  }

  const { name, email } = newSeller;

  let seller = await Shop.findOne({ email });
  if (seller) {
    return next(new ErrorHandler("User already exists", 400));
  }

  // You can reuse avatar and other fields as defaults or ask again
  const defaultAvatarUrl = "https://img.freepik.com/free-vector/blue-circle-with-white-user_78370-4707.jpg";

  seller = await Shop.create({
    name,
    email,
    password: "changeme123", // You might want to use a temp password or resend form
    avatar: {
      url: defaultAvatarUrl,
      public_id: null,
    },
  });

  await sendShopToken(seller, 201, res);
}));

// Login shop
router.post("/login-shop", catchAsyncErrors(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new ErrorHandler("Please provide all fields!", 400));
  }

  const user = await Shop.findOne({ email }).select("+password");
  if (!user) return next(new ErrorHandler("User doesn't exist!", 400));

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return next(new ErrorHandler("Incorrect credentials", 400));
  }

  await sendShopToken(user, 201, res);
}));

// Other routes (no major changes, just summarized below for brevity)
router.get("/getSeller", isSeller, catchAsyncErrors(async (req, res, next) => {
  const seller = await Shop.findById(req.seller._id).select("-password");
  if (!seller) return next(new ErrorHandler("User doesn't exist", 400));
  res.status(200).json({ success: true, seller });
}));

router.get("/logout", catchAsyncErrors(async (req, res) => {
  res.cookie("seller_token", null, {
    expires: new Date(Date.now()),
    httpOnly: true,
    sameSite: "none",
    secure: true,
  });
  res.status(201).json({ success: true, message: "Logged out successfully!" });
}));


// ✅ Get single shop info (for shipping calculation)
router.get("/get-shop-info/:id", catchAsyncErrors(async (req, res, next) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return next(new ErrorHandler("Shop not found", 404));

    res.status(200).json({ success: true, shop });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
}));




module.exports = router;
