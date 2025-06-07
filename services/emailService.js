import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
  constructor() {
    this.transporter = this.createTransporter();
  }

  // Create email transporter
  createTransporter() {
    // Gmail configuration requires a Gmail account with "Less secure app access" enabled
    // or an app password if you have 2-factor authentication enabled
    // See: https://nodemailer.com/usage/using-gmail/
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.GMAIL_USER, // Your Gmail account
        pass: process.env.GMAIL_PASS  // Your Gmail password or app password
      }
    });
  }

  // Send basic email
  async sendEmail(options) {
    try {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'CodeChef Notification'}" <${process.env.EMAIL_FROM || process.env.GMAIL_USER}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html || undefined
      };

      // Add CC if provided
      if (options.cc) {
        mailOptions.cc = options.cc;
      }

      // Add BCC if provided
      if (options.bcc) {
        mailOptions.bcc = options.bcc;
      }

      // Add attachments if provided
      if (options.attachments) {
        mailOptions.attachments = options.attachments;
      }

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  // Test email connection
  async testConnection() {
    try {
      await this.transporter.verify();
      console.log('Email service is ready to send messages');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}

// Create singleton instance
let emailServiceInstance = null;

// Initialize email service
export const initEmailService = () => {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
};

// Get email service instance
export const getEmailService = () => {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
};

export default {
  initEmailService,
  getEmailService
}; 