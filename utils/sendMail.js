const nodemailer = require("nodemailer");

const sendMail = async ({ email, subject, message, html }) => {
  const transporter = nodemailer.createTransport({
    service: "gmail", // or any other like SendGrid, Mailgun, etc.
    auth: {
      user: process.env.SMTP_MAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_MAIL,
    to: email,
    subject,
    text: message,
    html, // ✅ this allows HTML emails
  };

  await transporter.sendMail(mailOptions);
};











const generateResetEmailTemplate = (sellerName, resetUrl) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Reset Your Password</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 20px; font-family: Arial, sans-serif; border-radius: 8px;">
        <h2 style="color: #333;">Hello ${sellerName},</h2>
        <p style="color: #555;">You requested to reset your password on Local Handler. Please click the button below to choose a new password:</p>
        
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; margin: 20px 0; background-color: #f63b60; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;">
          Reset Password
        </a>

        <p style="color: #555;">Or copy and paste this link into your browser:</p>
        <p style="color: #555;"><a href="${resetUrl}" style="color: #0066cc;">${resetUrl}</a></p>

        <p style="color: #999; font-size: 12px;">If you did not request a password reset, you can safely ignore this email.</p>

        <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;" />
        <p style="color: #aaa; font-size: 12px;">© ${new Date().getFullYear()} Local Handler. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
};

module.exports = { generateResetEmailTemplate };










module.exports = sendMail;
