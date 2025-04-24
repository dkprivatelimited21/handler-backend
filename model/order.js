const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop", // Reference to the Shop model
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
      isReviewed: { type: Boolean, default: false },
    },
  ],
  shippingAddress: {
    address1: { type: String, required: true },
    address2: { type: String },
    zipCode: { type: String, required: true },
    country: { type: String, required: true },
    city: { type: String, required: true },
  },
  user: {
    _id: { type: String },
    name: { type: String },
    email: { type: String },
  },
  totalPrice: {
    type: Number,
    required: true,
    min: [0, "Total price cannot be less than 0"],
  },
  paymentInfo: {
    id: { type: String },
    status: { type: String },
    type: { type: String },
  },
  status: {
    type: String,
    default: "Not Shipped",
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
    default: Date.now,
  },
  deliveredAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Order", orderSchema);
