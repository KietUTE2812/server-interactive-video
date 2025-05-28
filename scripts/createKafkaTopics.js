/**
 * Script to create Kafka topics for the notification system
 * 
 * Usage:
 *   node scripts/createKafkaTopics.js
 * 
 * This script creates the necessary Kafka topics for the notification system.
 * Run this script before starting the application for the first time.
 */

import { kafkaConfig, createKafkaClient } from '../config/kafka.js';
import { TopicFactory } from 'kafka-node';
import dotenv from 'dotenv';

dotenv.config();

// Create Kafka client
const client = createKafkaClient();
const topicFactory = new TopicFactory(client);

// Topics to create with configuration
const topics = [
  {
    topic: kafkaConfig.topics.notifications,
    partitions: 1,
    replicationFactor: 1
  },
  {
    topic: kafkaConfig.topics.userNotifications,
    partitions: 1,
    replicationFactor: 1
  },
  {
    topic: kafkaConfig.topics.groupNotifications,
    partitions: 1,
    replicationFactor: 1
  }
];

// Create topics
topicFactory.create(topics, (err, data) => {
  if (err) {
    console.error('Error creating Kafka topics:', err);
    process.exit(1);
  }
  
  console.log('Kafka topics created successfully:', data);
  process.exit(0);
}); 