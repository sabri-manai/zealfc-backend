// services/emailService.js
require('dotenv/config');
const { MailerSend, EmailParams, Sender, Recipient } = require("mailersend");

const mailerSend = new MailerSend({
  apiKey: process.env.MAILERSEND_API_KEY,
});

const sendEmail = async ({ to, subject, html, text }) => {
  const sentFrom = new Sender(process.env.MAILERSEND_FROM_EMAIL, process.env.MAILERSEND_FROM_NAME);
  const recipients = [new Recipient(to.email, to.name)];

  const emailParams = new EmailParams()
    .setFrom(sentFrom)
    .setTo(recipients)
    .setSubject(subject)
    .setHtml(html)
    .setText(text);

    try {
        const response = await mailerSend.email.send(emailParams);
    } catch (error) {
        console.error(`Failed to send email to ${to.email}:`, error);
    }
  
};

module.exports = { sendEmail };
