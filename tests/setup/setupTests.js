import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

let mongoServer;

// Setup before all tests
beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Connect to the in-memory database
    await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    console.log('Connected to in-memory MongoDB for testing');
});

// Setup before each test
beforeEach(async () => {
    // Clear all collections before each test
    const collections = await mongoose.connection.db.collections();

    for (let collection of collections) {
        await collection.deleteMany({});
    }
});

// Cleanup after all tests
afterAll(async () => {
    // Close database connection
    await mongoose.connection.close();

    // Stop the in-memory MongoDB instance
    if (mongoServer) {
        await mongoServer.stop();
    }

    console.log('Disconnected from test database');
});

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
    ...console,
    // Uncomment to suppress console.log in tests
    // log: jest.fn(),
    // warn: jest.fn(),
    // error: jest.fn(),
};

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h'; 