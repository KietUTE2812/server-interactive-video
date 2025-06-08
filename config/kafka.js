import pkg from 'kafka-node';
const { KafkaClient, Producer, Consumer }  = pkg;
import dotenv from 'dotenv';

dotenv.config();
const kafkaConfig = {
  kafkaHost: process.env.KAFKA_HOST || 'localhost:9092',
  clientId: 'notification-service',
  topics: {
    notifications: 'notifications',
    userNotifications: 'user-notifications',
    groupNotifications: 'group-notifications',
    adminNotifications: 'admin-notifications',
    emailNotifications: 'email-notifications'
  }
};

// Create Kafka client
const createKafkaClient = () => {
  console.log(kafkaConfig.kafkaHost);
  return new KafkaClient({
    kafkaHost: kafkaConfig.kafkaHost,
    clientId: kafkaConfig.clientId
  });
};

// Create Kafka producer
const createProducer = () => {
  const client = createKafkaClient();
  //create producer
  const producer = new Producer(client);
  //create topic if not exists
  const topics = Object.values(kafkaConfig.topics);
  topics.forEach(topic => {
    client.createTopics([{ topic, partitions: 1, replicationFactor: 1 }], (err, result) => {
      if (err) {
        console.error(`Error creating topic ${topic}:`, err);
      }
    });
  });
  
  //return producer
  return producer;
};

// Create Kafka consumer
const createConsumer = (topics) => {
  const client = createKafkaClient();
  return new Consumer(
    client,
    topics.map(topic => ({ topic })),
    {
      autoCommit: true,
      fetchMaxWaitMs: 1000,
      fetchMaxBytes: 1024 * 1024,
      encoding: 'utf8'
    }
  );
};

export {
  kafkaConfig,
  createKafkaClient,
  createProducer,
  createConsumer
}; 