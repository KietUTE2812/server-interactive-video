# Kafka Notification System

This document outlines the implementation of a Kafka-based notification system that supports sending notifications to individual users, user groups, or broadcasting to all users.

## Overview

The notification system uses Apache Kafka as a message broker to handle high throughput notification delivery. It also integrates with Socket.IO for real-time notifications and supports email delivery through nodemailer.

### Key Components

1. **Kafka Producer/Consumer**: Handles the asynchronous message queue for notifications
2. **Socket.IO Server**: Delivers notifications in real-time to connected clients
3. **Email Service**: Sends email notifications using nodemailer
4. **MongoDB**: Stores notification data for persistent access
5. **REST API**: Provides endpoints for sending and managing notifications

## Setup Requirements

### Prerequisites

- Node.js (v14+)
- MongoDB (v4+)
- Kafka (v2+)

### Environment Variables

Add the following to your `.env` file:

```
# Kafka Configuration
KAFKA_HOST=localhost:9092
CLIENT_URL=http://localhost:5173

# Email Configuration (for email notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=Notification System
```

### Dependencies

These have been added to the package.json:

```
kafka-node: "^5.0.0"
socket.io: "^4.8.1"
nodemailer: "^7.0.3"
```

## Notification Types

The system supports three types of notifications:

1. **Individual**: Sent to a specific user (requires `userId`)
2. **Group**: Sent to a group of users (requires `groupName`)
3. **Broadcast**: Sent to all users in the system

Each notification can be delivered through one or more delivery methods based on the `isEmail` flag:
- When `isEmail=false` (default): Delivered only as in-app notification
- When `isEmail=true`: Delivered as both in-app and email notification

## Content Types

Notifications can include different types of content:

1. **Plain Text**: Simple text message
2. **HTML**: Rich HTML content for email or in-app display using the `htmlContent` field

## API Endpoints

### Get User Notifications

```
GET /api/v1/kafka-notifications
```

Returns all notifications for the authenticated user.

### Mark Notification as Read

```
PUT /api/v1/kafka-notifications/:id/read
```

Marks a specific notification as read.

### Mark All Notifications as Read

```
PUT /api/v1/kafka-notifications/read-all
```

Marks all notifications for the authenticated user as read.

### Send Notification to User (Admin Only)

```
POST /api/v1/kafka-notifications/user/:userId
```

Body:
```json
{
  "title": "Notification Title",
  "message": "Notification Message",
  "link": "/optional/link",
  "metadata": {},
  "htmlContent": "<p>Optional HTML content</p>",
  "isEmail": false
}
```

### Send Notification to Group (Admin Only)

```
POST /api/v1/kafka-notifications/group/:groupName
```

Body:
```json
{
  "title": "Group Notification",
  "message": "This is sent to a specific group",
  "link": "/optional/link",
  "metadata": {},
  "htmlContent": "<p>Optional HTML content</p>",
  "isEmail": true
}
```

### Send Broadcast Notification (Admin Only)

```
POST /api/v1/kafka-notifications/broadcast
```

Body:
```json
{
  "title": "Broadcast Notification",
  "message": "This is sent to all users",
  "link": "/optional/link",
  "metadata": {},
  "htmlContent": "<p>Optional HTML content</p>",
  "isEmail": true
}
```

## Client Integration

### Connecting to Socket.IO

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:2003');

// Authenticate with user ID after login
socket.emit('authenticate', userId);

// Join a group
socket.emit('joinGroup', 'groupName');

// Listen for notifications
socket.on('notification', (notification) => {
  console.log('New notification:', notification);
  
  // Check if notification has HTML content
  if (notification.htmlContent) {
    // Display rich HTML content
    document.getElementById('notification-content').innerHTML = notification.htmlContent;
  } else {
    // Display plain text
    document.getElementById('notification-content').textContent = notification.message;
  }
});
```

## Architecture

1. A notification is created through the API
2. The API sends the notification to the appropriate Kafka topic
3. Kafka consumers process the notification message
4. For each target user, a record is created in the database
5. Socket.IO emits in-app notifications to connected clients in real-time
6. If isEmail=true, email notifications are queued and processed asynchronously
7. Clients display the notification to users

This system is designed to scale horizontally by adding more Kafka consumers, Socket.IO nodes, and email processing workers as needed.

## Email Processing

Email notifications are processed asynchronously by a worker that:

1. Polls the database for unsent email notifications
2. Sends emails using nodemailer
3. Marks notifications as sent once delivered

This approach prevents email sending delays from affecting API response times.

## Error Handling

Errors in the notification system are logged but do not stop the main application flow. This ensures that a failure in the notification system doesn't affect the core application functionality.

## Monitoring

The Kafka consumers, producers, and email workers log their status and any errors. For production environments, consider implementing additional monitoring tools for Kafka, Socket.IO, and email delivery. 