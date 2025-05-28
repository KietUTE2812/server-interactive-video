/**
 * Test script for the email notification system
 * 
 * Usage: 
 *   node scripts/testEmailNotifications.js
 * 
 * This script will test sending notifications with the isEmail flag
 * to demonstrate both in-app and email delivery.
 * Make sure to set your GMAIL_USER and GMAIL_PASS environment variables before running this script.
 */

import { getEmailService } from '../services/emailService.js';
import { getNotificationService } from '../services/notificationService.js';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';

dotenv.config();

// Email address for testing if no users are found
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

const emailService = getEmailService();
const notificationService = getNotificationService();

// Test email connection first
const testConnection = async () => {
  try {
    const connected = await emailService.testConnection();
    if (!connected) {
      console.error('Email service failed to connect. Check your Gmail credentials (GMAIL_USER and GMAIL_PASS).');
      process.exit(1);
    }
    console.log('Email service connected successfully.');
    return true;
  } catch (error) {
    console.error('Error connecting to email service:', error);
    process.exit(1);
  }
};

// Find a test user
const findTestUser = async () => {
  const user = await User.findOne({}).limit(1);
  if (!user) {
    console.error('No users found in the database. Please create a user first.');
    process.exit(1);
  }
  console.log(`Found test user: ${user._id}`);
  return user;
};

// Test sending an in-app only notification
const testInAppNotification = async (userId) => {
  try {
    console.log(`Sending in-app only notification to user ${userId}...`);
    
    await notificationService.sendUserNotification(userId, {
      title: 'Test In-App Notification',
      message: 'This is a test in-app notification (no email).',
      link: 'https://example.com/test',
      metadata: { test: true, type: 'in-app-only' },
      isEmail: false
    });
    
    console.log('In-app notification sent successfully.');
    return true;
  } catch (error) {
    console.error('Error sending in-app notification:', error);
    return false;
  }
};

// Test sending a notification with email
const testEmailNotification = async (userId) => {
  try {
    console.log(`Sending notification with email to user ${userId}...`);
    
    await notificationService.sendUserNotification(userId, {
      title: 'Test Notification with Email',
      message: 'This is a test notification that should also be delivered via email.',
      link: 'https://example.com/test',
      metadata: { test: true, type: 'with-email' },
      isEmail: true
    });
    
    console.log('Notification with email sent successfully.');
    return true;
  } catch (error) {
    console.error('Error sending notification with email:', error);
    return false;
  }
};

// Test sending an HTML notification with email
const testHtmlEmailNotification = async (userId) => {
  try {
    console.log(`Sending HTML notification with email to user ${userId}...`);
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
        <h1 style="color: #4285f4;">HTML Notification Test</h1>
        <p>This is a <strong>test notification</strong> with <em>HTML formatting</em> that should be delivered via both in-app and email.</p>
        <ul>
          <li>The system can send HTML notifications</li>
          <li>You can include rich content</li>
          <li>And even <span style="color: #db4437;">colored text</span></li>
        </ul>
        <div style="margin-top: 20px; text-align: center;">
          <a href="https://example.com/test" style="display: inline-block; padding: 10px 20px; background-color: #4285f4; color: white; text-decoration: none; border-radius: 4px;">Test Button</a>
        </div>
      </div>
    `;
    
    await notificationService.sendUserNotification(userId, {
      title: 'Test HTML Notification with Email',
      message: 'This is a test notification with HTML content and email delivery.',
      htmlContent,
      link: 'https://example.com/test',
      metadata: { test: true, type: 'html-with-email' },
      isEmail: true
    });
    
    console.log('HTML notification with email sent successfully.');
    return true;
  } catch (error) {
    console.error('Error sending HTML notification with email:', error);
    return false;
  }
};

// Main test function
const runTests = async () => {
  try {
    // Test email connection
    await testConnection();
    
    // Find a test user
    const user = await findTestUser();
    
    // Run the notification tests
    await testInAppNotification(user._id);
    await testEmailNotification(user._id);
    await testHtmlEmailNotification(user._id);
    
    console.log('\nAll notification tests completed.');
    console.log('1. Check the app for in-app notifications.');
    console.log('2. Check your email for email notifications.');
    console.log('Note: Email delivery may take a few moments depending on your email provider.');
    
    // Exit after a delay to allow time for email processing
    setTimeout(() => {
      console.log('Test script completed.');
      process.exit(0);
    }, 5000);
    
  } catch (error) {
    console.error('Error during tests:', error);
    process.exit(1);
  }
};

// Run the tests
runTests(); 