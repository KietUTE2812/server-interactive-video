import request from 'supertest';
import app from '../../../server.js';
import User from '../../../models/User.js';
import jwt from 'jsonwebtoken';

describe('User API Integration Tests', () => {
    let server;
    let authToken;
    let testUser;

    beforeAll(async () => {
        // Start server for testing
        server = app.listen(0);
    });

    afterAll(async () => {
        // Close server
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    beforeEach(async () => {
        // Create a test user for authenticated requests
        testUser = new User({
            email: 'testuser@example.com',
            password: 'Test123!',
            fullName: 'Test User',
            role: 'student'
        });
        await testUser.save();

        // Generate auth token
        authToken = jwt.sign(
            { userId: testUser._id, email: testUser.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );
    });

    describe('POST /api/v1/users/register', () => {
        test('should register a new user with valid data', async () => {
            const userData = {
                email: 'newuser@example.com',
                password: 'NewUser123!',
                fullName: 'New User',
                role: 'student'
            };

            const response = await request(server)
                .post('/api/v1/users/register')
                .send(userData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.user.email).toBe(userData.email);
            expect(response.body.data.user.fullName).toBe(userData.fullName);
            expect(response.body.data.token).toBeDefined();

            // Verify user was saved to database
            const savedUser = await User.findOne({ email: userData.email });
            expect(savedUser).toBeTruthy();
        });

        test('should not register user with duplicate email', async () => {
            const userData = {
                email: testUser.email, // Use existing user's email
                password: 'Test123!',
                fullName: 'Duplicate User'
            };

            const response = await request(server)
                .post('/api/v1/users/register')
                .send(userData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('email');
        });

        test('should not register user with invalid email', async () => {
            const userData = {
                email: 'invalid-email',
                password: 'Test123!',
                fullName: 'Test User'
            };

            const response = await request(server)
                .post('/api/v1/users/register')
                .send(userData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        test('should not register user without required fields', async () => {
            const response = await request(server)
                .post('/api/v1/users/register')
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/v1/users/login', () => {
        test('should login with valid credentials', async () => {
            const loginData = {
                email: testUser.email,
                password: 'Test123!'
            };

            const response = await request(server)
                .post('/api/v1/users/login')
                .send(loginData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.token).toBeDefined();
            expect(response.body.data.user.email).toBe(testUser.email);
        });

        test('should not login with invalid email', async () => {
            const loginData = {
                email: 'nonexistent@example.com',
                password: 'Test123!'
            };

            const response = await request(server)
                .post('/api/v1/users/login')
                .send(loginData)
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Invalid');
        });

        test('should not login with invalid password', async () => {
            const loginData = {
                email: testUser.email,
                password: 'wrongpassword'
            };

            const response = await request(server)
                .post('/api/v1/users/login')
                .send(loginData)
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Invalid');
        });
    });

    describe('GET /api/v1/users/profile', () => {
        test('should get user profile with valid token', async () => {
            const response = await request(server)
                .get('/api/v1/users/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.user.email).toBe(testUser.email);
            expect(response.body.data.user.fullName).toBe(testUser.fullName);
            expect(response.body.data.user.password).toBeUndefined(); // Password should not be returned
        });

        test('should not get profile without token', async () => {
            const response = await request(server)
                .get('/api/v1/users/profile')
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('token');
        });

        test('should not get profile with invalid token', async () => {
            const response = await request(server)
                .get('/api/v1/users/profile')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(response.body.success).toBe(false);
        });
    });

    describe('PUT /api/v1/users/profile', () => {
        test('should update user profile with valid data', async () => {
            const updateData = {
                fullName: 'Updated Name',
                bio: 'Updated bio'
            };

            const response = await request(server)
                .put('/api/v1/users/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.user.fullName).toBe(updateData.fullName);

            // Verify update in database
            const updatedUser = await User.findById(testUser._id);
            expect(updatedUser.fullName).toBe(updateData.fullName);
        });

        test('should not update profile without authentication', async () => {
            const updateData = {
                fullName: 'Updated Name'
            };

            const response = await request(server)
                .put('/api/v1/users/profile')
                .send(updateData)
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        test('should not update email to existing email', async () => {
            // Create another user
            const anotherUser = new User({
                email: 'another@example.com',
                password: 'Test123!',
                fullName: 'Another User'
            });
            await anotherUser.save();

            const updateData = {
                email: 'another@example.com' // Try to use existing email
            };

            const response = await request(server)
                .put('/api/v1/users/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/v1/users/change-password', () => {
        test('should change password with valid current password', async () => {
            const passwordData = {
                currentPassword: 'Test123!',
                newPassword: 'NewPassword123!',
                confirmPassword: 'NewPassword123!'
            };

            const response = await request(server)
                .post('/api/v1/users/change-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send(passwordData)
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify new password works
            const loginResponse = await request(server)
                .post('/api/v1/users/login')
                .send({
                    email: testUser.email,
                    password: 'NewPassword123!'
                })
                .expect(200);

            expect(loginResponse.body.success).toBe(true);
        });

        test('should not change password with wrong current password', async () => {
            const passwordData = {
                currentPassword: 'WrongPassword',
                newPassword: 'NewPassword123!',
                confirmPassword: 'NewPassword123!'
            };

            const response = await request(server)
                .post('/api/v1/users/change-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send(passwordData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        test('should not change password if new passwords do not match', async () => {
            const passwordData = {
                currentPassword: 'Test123!',
                newPassword: 'NewPassword123!',
                confirmPassword: 'DifferentPassword123!'
            };

            const response = await request(server)
                .post('/api/v1/users/change-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send(passwordData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/v1/users/forgot-password', () => {
        test('should send reset email for existing user', async () => {
            const response = await request(server)
                .post('/api/v1/users/forgot-password')
                .send({ email: testUser.email })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('reset');
        });

        test('should handle non-existent email gracefully', async () => {
            const response = await request(server)
                .post('/api/v1/users/forgot-password')
                .send({ email: 'nonexistent@example.com' })
                .expect(200); // Still return 200 for security

            expect(response.body.success).toBe(true);
        });
    });

    describe('Rate Limiting', () => {
        test('should enforce rate limiting on login attempts', async () => {
            const loginData = {
                email: testUser.email,
                password: 'wrongpassword'
            };

            // Make multiple failed login attempts
            const promises = Array(10).fill().map(() =>
                request(server)
                    .post('/api/v1/users/login')
                    .send(loginData)
            );

            const responses = await Promise.all(promises);

            // Some requests should be rate limited
            const rateLimited = responses.some(res => res.status === 429);
            expect(rateLimited).toBe(true);
        });
    });
}); 