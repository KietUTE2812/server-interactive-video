/**
 * Client-side example for integrating with the Kafka notification system
 * 
 * This is a React-based example that shows how to connect to the notification
 * system using Socket.IO and handle real-time notifications.
 */

import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

// Notification component
const NotificationSystem = ({ userId, userGroups = [] }) => {
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Connect to Socket.IO when component mounts
  useEffect(() => {
    // Create socket connection
    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:2003');
    
    // Set up event listeners
    newSocket.on('connect', () => {
      console.log('Connected to notification server');
      
      // Authenticate with user ID
      if (userId) {
        newSocket.emit('authenticate', userId);
        
        // Join user groups
        userGroups.forEach(group => {
          newSocket.emit('joinGroup', group);
        });
      }
    });
    
    // Handle new notifications
    newSocket.on('notification', (notification) => {
      console.log('Received new notification:', notification);
      
      // Add to notifications and update unread count
      setNotifications(prevNotifications => [notification, ...prevNotifications]);
      setUnreadCount(prevCount => prevCount + 1);
      
      // Show browser notification if supported
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message
        });
      }
    });
    
    // Handle disconnection
    newSocket.on('disconnect', () => {
      console.log('Disconnected from notification server');
    });
    
    // Save socket to state
    setSocket(newSocket);
    
    // Clean up on unmount
    return () => {
      if (newSocket) {
        // Leave user groups
        userGroups.forEach(group => {
          newSocket.emit('leaveGroup', group);
        });
        
        newSocket.disconnect();
      }
    };
  }, [userId, userGroups]);
  
  // Load existing notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get('/api/v1/kafka-notifications', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        setNotifications(response.data.data);
        setUnreadCount(response.data.data.filter(n => !n.read).length);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching notifications:', error);
        setIsLoading(false);
      }
    };
    
    if (userId) {
      fetchNotifications();
    }
  }, [userId]);
  
  // Mark a notification as read
  const markAsRead = async (notificationId) => {
    try {
      await axios.put(`/api/v1/kafka-notifications/${notificationId}/read`, {}, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      // Update local state
      setNotifications(prevNotifications => 
        prevNotifications.map(n => 
          n._id === notificationId ? { ...n, read: true } : n
        )
      );
      
      setUnreadCount(prevCount => Math.max(0, prevCount - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };
  
  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      await axios.put('/api/v1/kafka-notifications/read-all', {}, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      // Update local state
      setNotifications(prevNotifications => 
        prevNotifications.map(n => ({ ...n, read: true }))
      );
      
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };
  
  // Notification bell UI example
  return (
    <div className="notification-system">
      <div className="notification-bell">
        <i className="fa fa-bell"></i>
        {unreadCount > 0 && (
          <span className="badge">{unreadCount}</span>
        )}
      </div>
      
      <div className="notification-dropdown">
        <div className="notification-header">
          <h3>Notifications</h3>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead}>Mark all as read</button>
          )}
        </div>
        
        {isLoading ? (
          <div className="loading">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="empty">No notifications</div>
        ) : (
          <ul className="notification-list">
            {notifications.map(notification => (
              <li 
                key={notification._id} 
                className={notification.read ? 'read' : 'unread'}
                onClick={() => {
                  if (!notification.read) {
                    markAsRead(notification._id);
                  }
                  
                  // Navigate to link if provided
                  if (notification.link && notification.link !== '#') {
                    window.location.href = notification.link;
                  }
                }}
              >
                <h4>{notification.title}</h4>
                <p>{notification.message}</p>
                <small>
                  {new Date(notification.createdAt).toLocaleString()}
                </small>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default NotificationSystem; 