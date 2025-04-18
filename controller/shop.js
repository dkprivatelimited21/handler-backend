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

// Create shop
router.post("/create-shop", catchAsyncErrors(async (req, res, next) => {
  const { email } = req.body;
  const sellerEmail = await Shop.findOne({ email });
  if (sellerEmail) {
    return next(new ErrorHandler("User already exists", 400));
  }

  const myCloud = await cloudinary.v2.uploader.upload(req.body.avatar, {
    folder: "avatars",
  });

  const seller = {
    name: req.body.name,
    email: email,
    password: req.body.password,
    avatar: {
      public_id: myCloud.public_id,
      url: myCloud.secure_url,
    },
    address: req.body.address,
    phoneNumber: req.body.phoneNumber,
    zipCode: req.body.zipCode,
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
    return next(new ErrorHandler(error.message, 500));
  }
}));

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
router.delete("/delete-seller/:id", isAuthenticated, isAdmin("Admin"), catchAsyncErrors(async (req, res, next) => {
  const seller = await Shop.findById(req.params.id);
  if (!seller) {
    return next(new ErrorHandler("Seller not found", 400));
  }

  await Shop.findByIdAndDelete(req.params.id);

  res.status(201).json({ success: true, message: "Seller deleted successfully!" });
}));

// Seller - Update withdrawal methods
router.put("/update-payment-methods", isSeller, catchAsyncErrors(async (req, res, next) => {
  const { withdrawMethod } = req.body;

  const seller = await Shop.findByIdAndUpdate(req.seller._id, {
    withdrawMethod,
  }, { new: true });

  res.status(201).json({ success: true, seller });
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
