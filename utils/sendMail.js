const nodemailer = require("nodemailer");

const sendMail = async ({ email, subject, message, html }) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_MAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_MAIL,
    to: email,
    subject,
    // ✅ Ensure text is always set
    text: message || "Please view this email in an HTML-compatible client.",
    html,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendMail;
