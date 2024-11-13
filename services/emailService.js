require('dotenv/config');
const nodemailer = require('nodemailer');

// Create a transporter using Brevo's SMTP
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com', // Brevo's SMTP server
  port: 587, // Use 587 for TLS
  secure: false, // Set to true if using port 465
  auth: {
    user: process.env.BREVO_SMTP_LOGIN, // Your Brevo SMTP login
    pass: process.env.BREVO_SMTP_PASSWORD, // Your Brevo SMTP password
  },
});

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_EMAIL}>`,
      to: to.email,
      subject: subject,
      text: text,
      html: html,
    });
    console.log(`Email sent: ${info.messageId}`);
  } catch (error) {
    console.error(`Failed to send email to ${to.email}:`, error);
  }
};

module.exports = { sendEmail };
