const express = require("express");
const path = require("path");
const router = express.Router();
const jwt = require("jsonwebtoken");
const sendMail = require("../utils/sendMail");
const Shop = require("../model/shop");
const { isAuthenticated, isSeller, isAdmin } = require("../middleware/auth");
const cloudinary = require("cloudinary");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const sendShopToken = require("../utils/shopToken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Product = require("../model/product");  // Assuming product model
const Order = require("../model/order");


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
    public_id: null, // optional
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


// Create activation token
const createActivationToken = (seller) => {
  return jwt.sign(seller, process.env.ACTIVATION_SECRET, {
    expiresIn: "5m",
  });
};

// Activate user
router.post("/activation", catchAsyncErrors(async (req, res, next) => {
  const { activation_token } = req.body;
  const newSeller = jwt.verify(activation_token, process.env.ACTIVATION_SECRET);
  if (!newSeller) {
    return next(new ErrorHandler("Invalid token", 400));
  }

  const { name, email, password, avatar, zipCode, address, phoneNumber } = newSeller;

  let seller = await Shop.findOne({ email });
  if (seller) {
    return next(new ErrorHandler("User already exists", 400));
  }

  seller = await Shop.create({ name, email, avatar, password, zipCode, address, phoneNumber });
  sendShopToken(seller, 201, res);
}));

// Login shop
router.post("/login-shop", catchAsyncErrors(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorHandler("Please provide all fields!", 400));
  }

  const user = await Shop.findOne({ email }).select("+password");
  if (!user) {
    return next(new ErrorHandler("User doesn't exist!", 400));
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return next(new ErrorHandler("Incorrect credentials", 400));
  }

  sendShopToken(user, 201, res);
}));

// Load shop
router.get("/getSeller", isSeller, catchAsyncErrors(async (req, res, next) => {
  const seller = await Shop.findById(req.seller._id).select("-password");
  if (!seller) {
    return next(new ErrorHandler("User doesn't exist", 400));
  }

  res.status(200).json({ success: true, seller });
}));

// Logout shop
router.get("/logout", catchAsyncErrors(async (req, res, next) => {
  res.cookie("seller_token", null, {
    expires: new Date(Date.now()),
    httpOnly: true,
    sameSite: "none",
    secure: true,
  });

  res.status(201).json({
    success: true,
    message: "Logged out successfully!",
  });
}));

// Get shop info (only admin sees sensitive data)
router.get("/get-shop-info/:id", isAuthenticated, catchAsyncErrors(async (req, res, next) => {
  const shop = await Shop.findById(req.params.id).lean();
  if (!shop) {
    return next(new ErrorHandler("Shop not found", 404));
  }

  const isAdmin = req.user?.role === "Admin";
  if (!isAdmin) {
    delete shop.phoneNumber;
    delete shop.address;
    delete shop.email;
  }

  res.status(200).json({ shop });
}));

// Update shop avatar
router.put("/update-shop-avatar", isSeller, catchAsyncErrors(async (req, res, next) => {
  const existsSeller = await Shop.findById(req.seller._id);

  await cloudinary.v2.uploader.destroy(existsSeller.avatar.public_id);

  const myCloud = await cloudinary.v2.uploader.upload(req.body.avatar, {
    folder: "avatars",
    width: 150,
  });

  existsSeller.avatar = {
    public_id: myCloud.public_id,
    url: myCloud.secure_url,
  };

  await existsSeller.save();

  res.status(200).json({
    success: true,
    seller: existsSeller,
  });
}));

// Update seller info
router.put("/update-seller-info", isSeller, catchAsyncErrors(async (req, res, next) => {
  const { name, description, address, phoneNumber, zipCode } = req.body;
  const shop = await Shop.findById(req.seller._id);

  if (!shop) {
    return next(new ErrorHandler("User not found", 400));
  }

  shop.name = name;
  shop.description = description;
  shop.address = address;
  shop.phoneNumber = phoneNumber;
  shop.zipCode = zipCode;

  await shop.save();

  res.status(201).json({
    success: true,
    shop,
  });
}));

// Admin - Get all sellers
router.get("/admin-all-sellers", isAuthenticated, isAdmin("Admin"), catchAsyncErrors(async (req, res, next) => {
  const sellers = await Shop.find().sort({ createdAt: -1 });
  res.status(201).json({ success: true, sellers });
}));

// Admin - Delete seller
router.delete(
  "/delete-seller/:id",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
    const sellerId = req.params.id;

    // 1. Delete the seller
    await Shop.findByIdAndDelete(sellerId);

    // 2. Delete all products related to this seller
    await Product.deleteMany({ shopId: sellerId });

    res.status(200).json({ success: true, message: "Seller and related products deleted." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting seller", error });
  }
}))

// Seller - Update withdrawal methods
router.put("/update-payment-methods", isSeller, catchAsyncErrors(async (req, res, next) => {
  const { withdrawMethod } = req.body;

  const seller = await Shop.findByIdAndUpdate(req.seller._id, {
    withdrawMethod,
  }, { new: true });

  res.status(201).json({ success: true, seller });
}));

//
const { generateResetEmailTemplate } = require("../utils/sendMail");

router.post("/forgot-password", catchAsyncErrors(async (req, res, next) => {
  const { email } = req.body;
  const shop = await Shop.findOne({ email });
  if (!shop) return next(new ErrorHandler("No seller found with this email", 404));

  const token = jwt.sign({ id: shop._id }, process.env.JWT_SECRET_KEY, {
    expiresIn: "15m",
  });

  const resetUrl = `https://everythingfree4200@gmail.com/shop/reset-password/${token}`;
  const html = generateResetEmailTemplate(shop.name, resetUrl);

  await sendMail({
    email: shop.email,
    subject: "Reset Your Password - Local Handler",
    message: "Reset your password using the link below.",
    html,
  });

  res.status(200).json({ message: "Reset link sent to your email" });
}));


//resetpassword

router.put("/reset-password/:token", catchAsyncErrors(async (req, res, next) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const shop = await Shop.findById(decoded.id);
    if (!shop) return next(new ErrorHandler("Invalid token or seller not found", 400));

    shop.password = await bcrypt.hash(password, 10);
    await shop.save();

    res.status(200).json({ message: "Password has been reset successfully" });
  } catch (error) {
    return next(new ErrorHandler("Invalid or expired token", 400));
  }
}));




// Seller - Delete withdrawal methods
router.delete("/delete-withdraw-method", isSeller, catchAsyncErrors(async (req, res, next) => {
  const seller = await Shop.findById(req.seller._id);
  if (!seller) {
    return next(new ErrorHandler("Seller not found", 400));
  }

  seller.withdrawMethod = null;
  await seller.save();

  res.status(201).json({ success: true, seller });
}));

module.exports = router;
