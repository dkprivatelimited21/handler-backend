const mongoose = require("mongoose");

const withdrawSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",  // Referencing the 'Shop' model
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    serviceCharge: {  // Adding service charge field
      type: Number,
      required: true,
    },
    status: {
      type: String,
      default: "Processing",
    },
  },
  { timestamps: true }  // Automatically handles createdAt and updatedAt
);

module.exports = mongoose.model("Withdraw", withdrawSchema);
