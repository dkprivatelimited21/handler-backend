const express = require("express");
const mongoose = require("mongoose");
const { isSeller, isAuthenticated, isAdmin } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const router = express.Router();
const Product = require("../model/product");
const Order = require("../model/order");
const Shop = require("../model/shop");
const cloudinary = require("cloudinary");
const ErrorHandler = require("../utils/ErrorHandler");

router.post(
  "/create-product",
  catchAsyncErrors(async (req, res, next) => {
    const shopId = req.body.shopId;

    // 1. Validate shopId format
    if (!mongoose.Types.ObjectId.isValid(shopId)) {
      return next(new ErrorHandler("Invalid Shop ID format", 400));
    }

    // 2. Check if shop exists
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return next(new ErrorHandler("Shop Id is invalid!", 400));
    }

    // 3. Handle image uploads
    let images = Array.isArray(req.body.images) ? req.body.images : [req.body.images];
    const imagesLinks = [];

    for (let i = 0; i < images.length; i++) {
      const result = await cloudinary.v2.uploader.upload(images[i], {
        folder: "products",
      });

      imagesLinks.push({
        public_id: result.public_id,
        url: result.secure_url,
      });
    }

    // 4. Prepare product data
    const productData = {
      ...req.body,
      images: imagesLinks,
      shop,
    };

    // 5. Parse sizes/colors if they are strings
    if (req.body.sizes && typeof req.body.sizes === "string") {
      productData.sizes = JSON.parse(req.body.sizes);
    }

    if (req.body.colors && typeof req.body.colors === "string") {
      productData.colors = JSON.parse(req.body.colors);
    }

    // 6. Create product
    const product = await Product.create(productData);

    res.status(201).json({
      success: true,
      product,
    });
  })
);

// get all products of a shop
router.get(
  "/get-all-products-shop/:id",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const products = await Product.find({ shopId: req.params.id });

      res.status(201).json({
        success: true,
        products,
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);

router.delete(
  "/delete-shop-product/:id",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    try {
      console.log("Deleting product:", req.params.id);
      const product = await Product.findById(req.params.id);

      if (!product) {
        return next(new ErrorHandler("Product not found", 404));
      }

      if (product.shop._id.toString() !== req.seller._id.toString()) {
        return next(
          new ErrorHandler("You are not allowed to delete this product", 403)
        );
      }

      for (let i = 0; i < product.images.length; i++) {
        console.log("Destroying image:", product.images[i].public_id);
        await cloudinary.v2.uploader.destroy(product.images[i].public_id);
      }

      await Product.findByIdAndDelete(product._id);

      res.status(200).json({
        success: true,
        message: "Product Deleted successfully!",
      });
    } catch (error) {
      console.error("Delete error:", error); // ✅ log backend error
      return next(new ErrorHandler(error.message, 500));
    }
  })
);


// get all products
router.get(
  "/get-all-products",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const products = await Product.find().sort({ createdAt: -1 });

      res.status(201).json({
        success: true,
        products,
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);

// review for a product
router.put(
  "/create-new-review",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { user, rating, comment, productId, orderId } = req.body;

      const product = await Product.findById(productId);

      const review = {
        user,
        rating,
        comment,
        productId,
      };

      const isReviewed = product.reviews.find(
        (rev) => rev.user._id === req.user._id
      );

      if (isReviewed) {
        product.reviews.forEach((rev) => {
          if (rev.user._id === req.user._id) {
            (rev.rating = rating), (rev.comment = comment), (rev.user = user);
          }
        });
      } else {
        product.reviews.push(review);
      }

      let avg = 0;

      product.reviews.forEach((rev) => {
        avg += rev.rating;
      });

      product.ratings = avg / product.reviews.length;

      await product.save({ validateBeforeSave: false });

      await Order.findByIdAndUpdate(
        orderId,
        { $set: { "cart.$[elem].isReviewed": true } },
        { arrayFilters: [{ "elem._id": productId }], new: true }
      );

      res.status(200).json({
        success: true,
        message: "Reviwed succesfully!",
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);

// get orders linked to seller's products
router.get(
  "/get-orders-for-seller/:sellerId",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const orders = await Order.find({
        "products.shop": req.params.sellerId,
      }).populate("products");

      res.status(200).json({
        success: true,
        orders,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);







// all products --- for admin
router.get(
  "/admin-all-products",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const products = await Product.find().sort({
        createdAt: -1,
      });
      res.status(201).json({
        success: true,
        products,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);
module.exports = router;
