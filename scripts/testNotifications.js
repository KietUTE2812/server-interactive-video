/**
 * Test script for the Kafka notification system
 * 
 * Usage: 
 *   node scripts/testNotifications.js
 * 
 * This script will simulate sending different types of notifications
 * through the Kafka notification system.
 */

import { createProducer, kafkaConfig } from '../config/kafka.js';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';

dotenv.config();

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

// Create Kafka producer
const producer = createProducer();

// Wait for producer to be ready
producer.on('ready', async () => {
  console.log('Kafka producer is ready');
  
  try {
    // Get a sample user for testing
    const users = await User.find({}).limit(2);
    
    if (users.length === 0) {
      console.log('No users found in the database. Please create some users first.');
      process.exit(0);
    }
    
    const testUser1 = users[0]._id;
    const testUser2 = users.length > 1 ? users[1]._id : users[0]._id;
    
    console.log(`Using test users: ${testUser1}, ${testUser2}`);
    
    // Test individual notification
    await sendTestNotification(
      kafkaConfig.topics.userNotifications,
      {
        user: testUser1,
        title: "Test Individual Notification",
        message: "This is a test notification for a specific user",
        link: "/test/link",
        metadata: { test: true }
      }
    );
    
    // Test group notification
    await sendTestNotification(
      kafkaConfig.topics.groupNotifications,
      {
        userGroup: "testGroup",
        title: "Test Group Notification",
        message: "This is a test notification for a group of users",
        link: "/test/group/link",
        metadata: { test: true, group: "testGroup" }
      }
    );
    
    // Test broadcast notification
    await sendTestNotification(
      kafkaConfig.topics.notifications,
      {
        title: "Test Broadcast Notification",
        message: "This is a test broadcast notification for all users",
        link: "/test/broadcast",
        metadata: { test: true, broadcast: true }
      }
    );
    
    console.log('All test notifications sent successfully!');
    
    // Give time for messages to be processed
    setTimeout(() => {
      console.log('Test completed. Exiting...');
      process.exit(0);
    }, 2000);
    
  } catch (error) {
    console.error('Error during test:', error);
    process.exit(1);
  }
});

producer.on('error', (err) => {
  console.error('Error with Kafka producer:', err);
  process.exit(1);
});

// Helper function to send notification
function sendTestNotification(topic, notification) {
  return new Promise((resolve, reject) => {
    const payload = [
      {
        topic,
        messages: JSON.stringify(notification),
        partition: 0
      }
    ];

    producer.send(payload, (err, data) => {
      if (err) {
        console.error(`Error sending to ${topic}:`, err);
        reject(err);
      } else {
        console.log(`Successfully sent to ${topic}:`, data);
        resolve(data);
      }
    });
  });
} 