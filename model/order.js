const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  shopId: {
    type: String,
    required: true,
  },
  cart: [
    {
      productId: { type: String, required: true },
      name: { type: String },
      quantity: { type: Number, required: true },
      price: { type: Number },
      selectedSize: { type: String },
      selectedColor: { type: String },
      image: { type: String },
      shopId: { type: String },
      isReviewed: { type: Boolean, default: false },
    },
  ],

  shippingAddress: {
    address1: { type: String },
    address2: { type: String },
    zipCode: { type: String },
    country: { type: String },
    city: { type: String },
  },

  user: {
    _id: { type: String },
    name: { type: String },
    email: { type: String },
  },

  totalPrice: {
    type: Number,
    required: true,
  },

  paymentInfo: {
    id: { type: String },
    status: { type: String },
    type: { type: String },
  },

  status: {
    type: String,
    default: "Not Shipped", // ✅ now every new order starts with this
  },

  trackingId: {
    type: String,
    default: "",
  },

  courier: {
    type: String,
    default: "",
  },

  paidAt: {
    type: Date,
    default: Date.now(),
  },
  deliveredAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
});

module.exports = mongoose.model("Order", orderSchema);
