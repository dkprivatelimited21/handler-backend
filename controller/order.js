const express = require("express");
const router = express.Router();
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated, isSeller, isAdmin } = require("../middleware/auth");
const Order = require("../model/order");
const Shop = require("../model/shop");
const Product = require("../model/product");

// ✅ CREATE NEW ORDER
// ✅ CREATE NEW ORDER
router.post(
  "/create-order",
  catchAsyncErrors(async (req, res, next) => {
    try {
      console.log("🧾 Incoming order payload:", req.body);

      const {
        cart,
        shippingAddress,
        user,
        totalPrice,
        paymentInfo,
      } = req.body;

      // Group by shop
      const shopItemsMap = new Map();

      for (const item of cart) {
        const shopId = item.shopId;
        if (!shopItemsMap.has(shopId)) {
          shopItemsMap.set(shopId, []);
        }

        shopItemsMap.get(shopId).push({
  productId: item.productId,
  quantity: Number(item.quantity),
  selectedSize: item.selectedSize || "",
  selectedColor: item.selectedColor || "",
  shopId: shopId, // ✅ ADD THIS
});

      }

      // Create orders per shop
      const orders = [];

      for (const [shopId, shopItems] of shopItemsMap) {
        const order = await Order.create({
          cart: shopItems,
          shopId: shopId, // ✅ Correct key
          shippingAddress,
          user,
          totalPrice,
          paymentInfo,
        });

        orders.push(order);
      }

      res.status(201).json({
        success: true,
        orders,
      });
    } catch (error) {
      console.error("🔥 Order creation error:", error);
      console.log("❗Full error stack:", error.stack);
      return next(new ErrorHandler(error.message || "Order creation failed", 500));
    }
  })
);



// ✅ GET ALL ORDERS OF A USER
// GET ALL ORDERS FOR A SELLER
router.get(
  "/get-seller-all-orders/:shopId",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const orders = await Order.find({
        shopId: req.params.shopId, // ✅ FIXED: match top-level shopId
      }).sort({
        createdAt: -1,
      });

      res.status(200).json({
        success: true,
        orders,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);


// ✅ GET ALL ORDERS FOR A SELLER
router.get(
  "/get-seller-all-orders/:shopId",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const orders = await Order.find({
        "cart.shopId": req.params.shopId,
      }).sort({
        createdAt: -1,
      });

      res.status(200).json({
        success: true,
        orders,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// ✅ UPDATE ORDER STATUS BY SELLER
// Add to top of file
const validCouriers = {
  delhivery: /^[0-9]{9,14}$/,
  bluedart: /^[A-Z0-9]{8,12}$/,
  ekart: /^FMPC[0-9A-Z]{8,12}$/,
  ecomExpress: /^[A-Z]{2}[0-9]{9}$/,
  xpressbees: /^XB[0-9]{9}$/,
  shadowfax: /^[A-Z0-9]{10,15}$/,
};

router.put(
  "/update-order-status/:id",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    const { status, trackingId, courier } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return next(new ErrorHandler("Order not found", 400));

    // 🚨 Validate tracking ID for Shipping status
    if (status === "Shipping") {
      if (!trackingId || !courier || !validCouriers[courier]) {
        return next(new ErrorHandler("Courier and tracking ID required", 400));
      }
      const pattern = validCouriers[courier];
      if (!pattern.test(trackingId)) {
        return next(new ErrorHandler("Invalid tracking ID format", 400));
      }
      order.trackingId = trackingId;
      order.courier = courier;
    }

    order.status = status;

    if (status === "Delivered") {
      order.deliveredAt = Date.now();
      order.paymentInfo.status = "Succeeded";
      const serviceCharge = order.totalPrice * 0.1;
      const seller = await Shop.findById(req.seller.id);
      seller.availableBalance = order.totalPrice - serviceCharge;
      await seller.save();
    }

    await order.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      order,
    });
  })
);


// ✅ USER REQUESTS A REFUND
router.put(
  "/order-refund/:id",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const order = await Order.findById(req.params.id);

      if (!order) {
        return next(new ErrorHandler("Order not found with this id", 400));
      }

      order.status = req.body.status;
      await order.save({ validateBeforeSave: false });

      res.status(200).json({
        success: true,
        order,
        message: "Order Refund Request successfully!",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// ✅ SELLER ACCEPTS THE REFUND
router.put(
  "/order-refund-success/:id",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const order = await Order.findById(req.params.id);

      if (!order) {
        return next(new ErrorHandler("Order not found with this id", 400));
      }

      order.status = req.body.status;
      await order.save();

      res.status(200).json({
        success: true,
        message: "Order Refund successful!",
      });

      if (req.body.status === "Refund Success") {
        order.cart.forEach(async (o) => {
          await updateOrder(o._id, o.qty);
        });
      }

      async function updateOrder(id, qty) {
        const product = await Product.findById(id);
        product.stock += qty;
        product.sold_out -= qty;
        await product.save({ validateBeforeSave: false });
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// ✅ ADMIN FETCHES ALL ORDERS
router.get(
  "/admin-all-orders",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const orders = await Order.find().sort({
        deliveredAt: -1,
        createdAt: -1,
      });

      res.status(201).json({
        success: true,
        orders,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

module.exports = router;
