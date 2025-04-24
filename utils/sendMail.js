const nodemailer = require("nodemailer");

const sendMail = async (options) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_MAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const mailOptions = {
    from: `"Local Handler" <${process.env.SMTP_MAIL}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html || null,
  };

  await transporter.sendMail(mailOptions);
};

console.log("SMTP_MAIL:", process.env.SMTP_MAIL);
console.log("SMTP_PASSWORD:", process.env.SMTP_PASSWORD ? "Present ✅" : "Missing ❌");


const generateResetEmailTemplate = (name, resetUrl) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px;">
      <h2 style="color: #333;">Hello ${name},</h2>
      <p style="color: #555;">You requested to reset your password on <strong>Local Handler</strong>.</p>
      <p style="color: #555;">Click the button below to set a new password:</p>
      <a href="${resetUrl}" style="display: inline-block; margin-top: 10px; padding: 10px 20px; background-color: #1d4ed8; color: #fff; text-decoration: none; border-radius: 5px;">
        Reset Password
      </a>
      <p style="margin-top: 20px; color: #999;">If you did not request this, please ignore this email.</p>
      <hr style="margin-top: 30px;" />
      <p style="font-size: 12px; color: #aaa;">&copy; ${new Date().getFullYear()} Local Handler. All rights reserved.</p>
    </div>
  `;
};

module.exports = {
  sendMail,
  generateResetEmailTemplate,
};
