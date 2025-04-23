const User = require("../model/user");
const jwt = require("jsonwebtoken");
const ErrorHandler = require("../utils/ErrorHandler");
const sendMail = require("../utils/sendMail");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

// Forgot Password
exports.forgotPassword = catchAsyncErrors(async (req, res, next) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) return next(new ErrorHandler("User not found", 404));

  const resetToken = jwt.sign({ id: user._id }, process.env.RESET_PASSWORD_SECRET, {
    expiresIn: "15m",
  });

  user.resetPasswordToken = resetToken;
  user.resetPasswordTime = Date.now() + 15 * 60 * 1000;
  await user.save();

  const resetUrl = `https://local-handler.vercel.app/password/reset/${resetToken}`;

  await sendMail({
    email: user.email,
    subject: "Reset your password",
    message: `Hi ${user.name}, reset your password by clicking this link: ${resetUrl}`,
  });

  res.status(200).json({ success: true, message: "Reset email sent!" });
});

// Reset Password
exports.resetPassword = catchAsyncErrors(async (req, res, next) => {
  const { token, newPassword } = req.body;

  const decoded = jwt.verify(token, process.env.RESET_PASSWORD_SECRET);
  const user = await User.findOne({
    _id: decoded.id,
    resetPasswordToken: token,
    resetPasswordTime: { $gt: Date.now() },
  });

  if (!user) return next(new ErrorHandler("Token is invalid or has expired", 400));

  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordTime = undefined;
  await user.save();

  res.status(200).json({ success: true, message: "Password reset successful!" });
});
