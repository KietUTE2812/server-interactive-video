import jwt from 'jsonwebtoken';
import User from '../../models/User.js';
import Course from '../../models/Course.js';
import Category from '../../models/Category.js';

/**
 * Create a test user
 * @param {Object} userData - User data override
 * @returns {Promise<Object>} Created user
 */
export const createTestUser = async (userData = {}) => {
    const defaultUserData = {
        email: `test${Date.now()}@example.com`,
        password: 'Test123!',
        fullName: 'Test User',
        role: 'student',
        ...userData
    };

    const user = new User(defaultUserData);
    await user.save();
    return user;
};

/**
 * Create multiple test users
 * @param {number} count - Number of users to create
 * @param {Object} userData - Base user data
 * @returns {Promise<Array>} Array of created users
 */
export const createTestUsers = async (count = 5, userData = {}) => {
    const users = [];
    for (let i = 0; i < count; i++) {
        const user = await createTestUser({
            email: `test${Date.now()}_${i}@example.com`,
            fullName: `Test User ${i + 1}`,
            ...userData
        });
        users.push(user);
    }
    return users;
};

/**
 * Generate JWT token for test user
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
export const generateAuthToken = (user) => {
    return jwt.sign(
        {
            userId: user._id,
            email: user.email,
            role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );
};

/**
 * Create a test course
 * @param {Object} courseData - Course data override
 * @param {Object} instructor - Instructor user object
 * @returns {Promise<Object>} Created course
 */
export const createTestCourse = async (courseData = {}, instructor = null) => {
    if (!instructor) {
        instructor = await createTestUser({ role: 'instructor' });
    }

    const defaultCourseData = {
        title: `Test Course ${Date.now()}`,
        description: 'A test course for testing purposes',
        instructor: instructor._id,
        price: 100000,
        level: 'Beginner',
        status: 'published',
        ...courseData
    };

    const course = new Course(defaultCourseData);
    await course.save();
    return course;
};

/**
 * Create multiple test courses
 * @param {number} count - Number of courses to create
 * @param {Object} courseData - Base course data
 * @param {Object} instructor - Instructor user object
 * @returns {Promise<Array>} Array of created courses
 */
export const createTestCourses = async (count = 3, courseData = {}, instructor = null) => {
    if (!instructor) {
        instructor = await createTestUser({ role: 'instructor' });
    }

    const courses = [];
    for (let i = 0; i < count; i++) {
        const course = await createTestCourse({
            title: `Test Course ${i + 1} - ${Date.now()}`,
            description: `Test course ${i + 1} description`,
            ...courseData
        }, instructor);
        courses.push(course);
    }
    return courses;
};

/**
 * Create test categories
 * @returns {Promise<Array>} Array of created categories
 */
export const createTestCategories = async () => {
    const categories = [
        { name: 'JavaScript', description: 'JavaScript programming language' },
        { name: 'Python', description: 'Python programming language' },
        { name: 'React', description: 'React JavaScript library' },
        { name: 'Node.js', description: 'Node.js runtime environment' }
    ];

    const createdCategories = [];
    for (const categoryData of categories) {
        const category = new Category(categoryData);
        await category.save();
        createdCategories.push(category);
    }
    return createdCategories;
};

/**
 * Clean up test data
 * @param {Array} collections - Array of collection names to clean
 */
export const cleanupTestData = async (collections = ['users', 'courses', 'categories']) => {
    const mongoose = await import('mongoose');

    for (const collectionName of collections) {
        if (mongoose.connection.collections[collectionName]) {
            await mongoose.connection.collections[collectionName].deleteMany({});
        }
    }
};

/**
 * Create authenticated request headers
 * @param {Object} user - User object
 * @returns {Object} Headers with authorization
 */
export const getAuthHeaders = (user) => {
    const token = generateAuthToken(user);
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
};

/**
 * Wait for specified milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise}
 */
export const delay = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Generate random string
 * @param {number} length - Length of string
 * @returns {string} Random string
 */
export const generateRandomString = (length = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

/**
 * Generate random email
 * @returns {string} Random email
 */
export const generateRandomEmail = () => {
    return `test_${generateRandomString(8)}@example.com`;
};

/**
 * Mock external service responses
 */
export const mockExternalServices = () => {
    // Mock AWS S3
    jest.mock('@aws-sdk/client-s3', () => ({
        S3Client: jest.fn().mockImplementation(() => ({
            send: jest.fn().mockResolvedValue({ Location: 'https://mock-s3-url.com/file.jpg' })
        })),
        PutObjectCommand: jest.fn(),
        GetObjectCommand: jest.fn(),
        DeleteObjectCommand: jest.fn()
    }));

    // Mock email service
    jest.mock('nodemailer', () => ({
        createTransport: jest.fn().mockReturnValue({
            sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-message-id' })
        })
    }));

    // Mock VNPay
    jest.mock('vnpay', () => ({
        VNPay: jest.fn().mockImplementation(() => ({
            buildPaymentUrl: jest.fn().mockReturnValue('https://mock-vnpay-url.com'),
            verifyReturnUrl: jest.fn().mockReturnValue({ isSuccess: true })
        }))
    }));
};

/**
 * Assertion helpers
 */
export const expectValidObjectId = (id) => {
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(id).toMatch(/^[0-9a-fA-F]{24}$/);
};

export const expectValidEmail = (email) => {
    expect(email).toBeDefined();
    expect(typeof email).toBe('string');
    expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
};

export const expectValidJWT = (token) => {
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
};

export const expectValidDate = (date) => {
    expect(date).toBeDefined();
    expect(new Date(date)).toBeInstanceOf(Date);
    expect(new Date(date).getTime()).not.toBeNaN();
};

/**
 * Database state helpers
 */
export const getCollectionCount = async (model) => {
    return await model.countDocuments();
};

export const findDocumentById = async (model, id) => {
    return await model.findById(id);
};

/**
 * Performance testing helpers
 */
export const measureExecutionTime = async (fn) => {
    const start = Date.now();
    const result = await fn();
    const end = Date.now();
    return {
        result,
        executionTime: end - start
    };
};

/**
 * Error simulation helpers
 */
export const simulateNetworkError = () => {
    return new Error('Network Error: Connection failed');
};

export const simulateDatabaseError = () => {
    return new Error('Database Error: Connection lost');
};

export const simulateValidationError = (field) => {
    const error = new Error(`Validation Error: ${field} is required`);
    error.name = 'ValidationError';
    return error;
}; 