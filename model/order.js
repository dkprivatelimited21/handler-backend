const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    cart: [
  {
    productId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
    },
    quantity: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
    },
    selectedSize: {
      type: String,
    },
    selectedColor: {
      type: String,
    },
    image: {
      type: String,
    },
    shopId: {
      type: String,
    },
    isReviewed: {
      type: Boolean,
      default: false,
    },
	trackingId: {
  	type: String,
  	default: null,
    },
  },
],

    paymentInfo:{
        id:{
            type: String,
        },
        status: {
            type: String,
        },
        type:{
            type: String,
        },
    },
    paidAt:{
        type: Date,
        default: Date.now(),
    },
    deliveredAt: {
        type: Date,
    },
    createdAt:{
        type: Date,
        default: Date.now(),
    },
});

module.exports = mongoose.model("Order", orderSchema);