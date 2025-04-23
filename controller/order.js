const PDFDocument = require("pdfkit");
const fs = require("fs");
const express = require("express");
const router = express.Router();
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated, isSeller, isAdmin } = require("../middleware/auth");
const Order = require("../model/order");
const Shop = require("../model/shop");
const Product = require("../model/product");

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
          shopId: shopId,
        });
      }

      // Create orders per shop
      const orders = [];

      for (const [shopId, shopItems] of shopItemsMap) {
        const order = await Order.create({
          cart: shopItems,
          shopId: shopId,
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

// ✅ DOWNLOAD INVOICE
router.get(
  "/download-invoice/:orderId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const order = await Order.findById(req.params.orderId);
      if (!order) return next(new ErrorHandler("Order not found", 404));

      // Check if the user is the owner of the order (either the user or the seller)
      if (
        order.user._id.toString() !== req.user._id.toString() &&
        order.shopId.toString() !== req.seller._id.toString()
      ) {
        return next(new ErrorHandler("Unauthorized access", 403));
      }

      const doc = new PDFDocument({ margin: 50 });

      // Set response headers
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=invoice_${order._id}.pdf`
      );

      // Pipe PDF to response
      doc.pipe(res);

      // 🧾 Build Invoice PDF content
      doc.fontSize(20).text("Order Invoice", { align: "center" });
      doc.moveDown();

      doc.fontSize(12).text(`Order ID: ${order._id}`);
      doc.text(`Customer: ${order.user.name || "Guest"}`);
      doc.text(`Email: ${order.user.email}`);
      doc.text(`Date: ${new Date(order.createdAt).toLocaleString()}`);
      doc.moveDown();

      doc.fontSize(14).text("Shipping Address:");
      doc.fontSize(12).text(`${order.shippingAddress.address}, ${order.shippingAddress.city}, ${order.shippingAddress.country} - ${order.shippingAddress.zipCode}`);
      doc.moveDown();

      doc.fontSize(14).text("Order Items:");
      order.cart.forEach((item, index) => {
        doc.fontSize(12).text(
          `${index + 1}. Product ID: ${item.productId}, Quantity: ${item.quantity}, Size: ${item.selectedSize}, Color: ${item.selectedColor}`
        );
      });
      doc.moveDown();

      doc.fontSize(14).text(`Total Amount Paid: ₹${order.totalPrice}`);
      doc.fontSize(12).text(`Payment Method: ${order.paymentInfo.type || "UPI"}`);
      doc.text(`Payment Status: ${order.paymentInfo.status}`);
      doc.moveDown();

      doc.text("Thank you for shopping with Local Handler!");

      doc.end(); // Finalize the PDF

    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// ✅ GET ALL ORDERS OF A USER
router.get(
  "/get-all-orders/:userId",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const orders = await Order.find({ "user._id": req.params.userId }).sort({
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
