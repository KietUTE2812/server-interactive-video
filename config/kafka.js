import pkg from 'kafka-node';
const { KafkaClient, Producer, Consumer }  = pkg;

const kafkaConfig = {
  kafkaHost: process.env.KAFKA_HOST || 'localhost:9092',
  clientId: 'notification-service',
  topics: {
    notifications: 'notifications',
    userNotifications: 'user-notifications',
    groupNotifications: 'group-notifications'
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
  return new Producer(client);
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