import { kafkaConfig, createProducer, createConsumer } from '../config/kafka.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { getEmailService } from './emailService.js';
import asyncHandler from 'express-async-handler';

class NotificationService {
  constructor(io) {
    this.producer = createProducer();
    this.io = io;
    this.emailService = getEmailService();
    this.setupKafkaProducer();
    this.setupKafkaConsumer();
    this.startEmailProcessingQueue();
  }

  // Setup Kafka producer
  setupKafkaProducer() {
    this.producer.on('ready', () => {
      console.log('Kafka Producer is ready');
    });

    this.producer.on('error', (err) => {
      console.error('Error with Kafka producer:', err);
    });
  }

  // Setup Kafka consumer
  setupKafkaConsumer() {
    const topics = [
      kafkaConfig.topics.notifications,
      kafkaConfig.topics.userNotifications,
      kafkaConfig.topics.groupNotifications
    ];

    this.consumer = createConsumer(topics);

    this.consumer.on('message', async (message) => {
      try {
        const messageValue = JSON.parse(message.value);
        
        switch (message.topic) {
          case kafkaConfig.topics.notifications:
            await this.handleBroadcastNotification(messageValue);
            break;
          case kafkaConfig.topics.userNotifications:
            await this.handleUserNotification(messageValue);
            break;
          case kafkaConfig.topics.groupNotifications:
            await this.handleGroupNotification(messageValue);
            break;
          case kafkaConfig.topics.adminNotifications:
            await this.handleAdminNotification(messageValue);
            break;
          default:
            console.log(`Unknown topic: ${message.topic}`);
        }
      } catch (error) {
        console.error('Error processing Kafka message:', error);
      }
    });

    this.consumer.on('error', (err) => {
      console.error('Error with Kafka consumer:', err);
    });
  }

  // Start email processing queue
  startEmailProcessingQueue() {
    // Process emails every minute
    setInterval(async () => {
      try {
        this.processEmailNotifications();
      } catch (error) {
        console.error('Error processing email notifications:', error);
      }
    }, 60000); // Every minute
  }

  // Process email notifications
  async processEmailNotifications() {
    try {
      // Find notifications that need email delivery but haven't been sent yet
      const notificationsToSend = await Notification.find({
        deliveryMethod: 'email',
        emailSent: false
      }).limit(50); // Process 50 at a time
      
      if (notificationsToSend.length === 0) return;
      
      console.log(`Processing ${notificationsToSend.length} email notifications`);
      
      for (const notification of notificationsToSend) {
        try {
          // If notification has direct email
          if (notification.email) {
            await this.emailService.sendNotificationEmail(notification);
          } 
          // If notification is for a user, get their email
          else if (notification.user) {
            const user = await User.findById(notification.user);
            if (user && user.email) {
              await this.emailService.sendNotificationEmailToUser(user, notification);
            } else {
              console.log(`User ${notification.user} has no email address`);
            }
          }
          
          // Mark notification as sent
          notification.emailSent = true;
          notification.emailSentAt = new Date();
          await notification.save();
          
        } catch (error) {
          console.error(`Error sending email for notification ${notification._id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing email notifications:', error);
    }
  }

  // Send notification to Kafka
  sendNotification(topic, notification) {
    return new Promise((resolve, reject) => {
      const payload = [
        {
          topic,
          messages: JSON.stringify(notification),
          partition: 0
        }
      ];

      this.producer.send(payload, (err, data) => {
        if (err) {
          console.error('Error sending to Kafka:', err);
          reject(err);
        } else {
          console.log('Successfully sent to Kafka:', data);
          resolve(data);
        }
      });
    });
  }

  // Create notification in database and emit to socket
  async createNotificationAndEmit(notificationData) {
    try {
      const notification = await Notification.create(notificationData);
      
      // Only emit in-app notifications to socket
      if (notification.deliveryMethod.includes('in-app')) {
        if (notification.user) {
          this.io.to(`user:${notification.user}`).emit('notification:new', notification);
          console.log(`Emitting notification to user: ${notification.user}`);
        } else if (notification.userGroup) {
          this.io.to(`group:${notification.userGroup}`).emit('notification:new', notification);
          console.log(`Emitting notification to group: ${notification.userGroup}`);
        }
      }
      
      // If notification should be delivered by email and is email type, queue it
      if (notification.deliveryMethod.includes('email') && notification.email) {
        // Email will be processed by the email queue
      }
      
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Handle broadcast notification (to all users)
  async handleBroadcastNotification(messageValue) {
    try {
      const users = await User.find({}, '_id');

      const notificationData = {
        ...messageValue,
        users: users.map(user => user._id),
        notificationType: 'broadcast'
      };
      
      await this.createNotificationAndEmit(notificationData);
    } catch (error) {
      console.error('Error handling broadcast notification:', error);
    }
  }

  // Handle user notification (to a specific user)
  async handleUserNotification(messageValue) {
    try { 

      const notificationData = {
        ...messageValue,
        notificationType: 'individual'
      };
      
      await this.createNotificationAndEmit(notificationData);
    } catch (error) {
      console.error('Error handling user notification:', error);
    }
  }

  // Handle admin notification (to all admin)
  async handleAdminNotification(messageValue) {
    try {
      const notificationData = {
        ...messageValue,
        isSystem: true
      };
      
      await this.createNotificationAndEmit(notificationData);
    } catch (error) {
      console.error('Error handling admin notification:', error);
    }
  }
  

  // Handle group notification (to a group of users)
  async handleGroupNotification(messageValue) {
    try { 

      const notificationData = {
        ...messageValue,
        notificationType: 'group'
      };
      
      await this.createNotificationAndEmit(notificationData);
    } catch (error) {
      console.error('Error handling group notification:', error);
    }
  }
  

  // Send notification to all users
  async sendBroadcastNotification(notification) {
    try { 
      return await this.sendNotification(kafkaConfig.topics.notifications, notification);
    } catch (error) {
      console.error('Error sending broadcast notification:', error);
      throw error;
    }
  }

  // Send notification to a specific user
  async sendUserNotification(userId, notification) {
    try {
      const notificationWithUser = {
        ...notification,
        user: userId
      };
      
      return await this.sendNotification(kafkaConfig.topics.userNotifications, notificationWithUser);
    } catch (error) {
      console.error('Error sending user notification:', error);
      throw error;
    }
  }

  // Send notification to a group of users
  async sendGroupNotification(groupName, notification) {
    try {
      const notificationWithGroup = {
        ...notification,
        userGroup: groupName
      };
      
      return await this.sendNotification(kafkaConfig.topics.groupNotifications, notificationWithGroup);
    } catch (error) {
      console.error('Error sending group notification:', error);
      throw error;
    }
  }

  // Send notification to all admin
  async sendAdminNotification(notification) {
    try {
      return await this.sendNotification(kafkaConfig.topics.adminNotifications, notification);
    } catch (error) {
      console.error('Error sending admin notification:', error);
      throw error;
    }
  }
  

  // Send direct email notification
  async sendEmailNotification(email, notification) {
    try {
      const notificationWithEmail = {
        ...notification,
        email,
        notificationType: 'email',
        deliveryMethod: ['email']
      };
      
      // Create notification directly in database
      await this.createNotificationAndEmit(notificationWithEmail);
      
      return true;
    } catch (error) {
      console.error('Error sending email notification:', error);
      throw error;
    }
  }

  // Send HTML notification to user
  async sendHtmlNotification(userId, notification) {
    try {
      const notificationWithUser = {
        ...notification,
        user: userId,
        htmlContent: notification.htmlContent
      };
      
      return await this.sendNotification(kafkaConfig.topics.userNotifications, notificationWithUser);
    } catch (error) {
      console.error('Error sending HTML notification:', error);
      throw error;
    }
  }
}

let notificationServiceInstance = null;

// Initialize the notification service with Socket.IO instance
export const initNotificationService = (io) => {
  if (!notificationServiceInstance?.io) {
    notificationServiceInstance = new NotificationService(io);
  }
  return notificationServiceInstance;
};

// Get the notification service instance
export const getNotificationService = () => {
  if (!notificationServiceInstance) {
    throw new Error('Notification service not initialized');
  }
  
  return notificationServiceInstance;
};

export default {
  initNotificationService,
  getNotificationService
}; 