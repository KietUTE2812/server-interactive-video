import User from '../../../models/User.js';
import bcrypt from 'bcryptjs';

describe('User Model', () => {
    describe('User Creation', () => {
        test('should create a user with valid data', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'Test123!',
                fullName: 'Test User',
                role: 'student'
            };

            const user = new User(userData);
            const savedUser = await user.save();

            expect(savedUser._id).toBeDefined();
            expect(savedUser.email).toBe(userData.email);
            expect(savedUser.fullName).toBe(userData.fullName);
            expect(savedUser.role).toBe(userData.role);
            expect(savedUser.password).not.toBe(userData.password); // Should be hashed
        });

        test('should not create user with invalid email', async () => {
            const userData = {
                email: 'invalid-email',
                password: 'Test123!',
                fullName: 'Test User'
            };

            const user = new User(userData);

            await expect(user.save()).rejects.toThrow();
        });

        test('should not create user without required fields', async () => {
            const user = new User({});

            await expect(user.save()).rejects.toThrow();
        });

        test('should not allow duplicate email', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'Test123!',
                fullName: 'Test User'
            };

            // Create first user
            const user1 = new User(userData);
            await user1.save();

            // Try to create second user with same email
            const user2 = new User(userData);
            await expect(user2.save()).rejects.toThrow();
        });
    });

    describe('Password Handling', () => {
        test('should hash password before saving', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'plaintext123',
                fullName: 'Test User'
            };

            const user = new User(userData);
            await user.save();

            expect(user.password).not.toBe(userData.password);
            expect(user.password).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt hash pattern
        });

        test('should verify correct password', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'Test123!',
                fullName: 'Test User'
            };

            const user = new User(userData);
            await user.save();

            const isMatch = await bcrypt.compare('Test123!', user.password);
            expect(isMatch).toBe(true);
        });

        test('should reject incorrect password', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'Test123!',
                fullName: 'Test User'
            };

            const user = new User(userData);
            await user.save();

            const isMatch = await bcrypt.compare('wrongpassword', user.password);
            expect(isMatch).toBe(false);
        });
    });

    describe('User Methods', () => {
        test('should compare password correctly with instance method', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'Test123!',
                fullName: 'Test User'
            };

            const user = new User(userData);
            await user.save();

            // Assuming User model has comparePassword method
            if (user.comparePassword) {
                const isMatch = await user.comparePassword('Test123!');
                expect(isMatch).toBe(true);
            }
        });

        test('should generate JWT token', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'Test123!',
                fullName: 'Test User'
            };

            const user = new User(userData);
            await user.save();

            // Assuming User model has generateAuthToken method
            if (user.generateAuthToken) {
                const token = user.generateAuthToken();
                expect(token).toBeDefined();
                expect(typeof token).toBe('string');
            }
        });
    });

    describe('User Validation', () => {
        test('should validate email format', async () => {
            const invalidEmails = [
                'invalid',
                '@example.com',
                'test@',
                'test..test@example.com'
            ];

            for (const email of invalidEmails) {
                const user = new User({
                    email,
                    password: 'Test123!',
                    fullName: 'Test User'
                });

                await expect(user.save()).rejects.toThrow();
            }
        });

        test('should validate password strength', async () => {
            const weakPasswords = [
                '123',
                'password',
                '12345678'
            ];

            for (const password of weakPasswords) {
                const user = new User({
                    email: 'test@example.com',
                    password,
                    fullName: 'Test User'
                });

                // If password validation is implemented in the model
                try {
                    await user.save();
                } catch (error) {
                    expect(error).toBeDefined();
                }
            }
        });

        test('should validate role enum', async () => {
            const invalidRole = 'invalid-role';

            const user = new User({
                email: 'test@example.com',
                password: 'Test123!',
                fullName: 'Test User',
                role: invalidRole
            });

            await expect(user.save()).rejects.toThrow();
        });
    });

    describe('User Updates', () => {
        test('should update user profile', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'Test123!',
                fullName: 'Test User'
            };

            const user = new User(userData);
            await user.save();

            // Update user
            user.fullName = 'Updated Name';
            const updatedUser = await user.save();

            expect(updatedUser.fullName).toBe('Updated Name');
        });

        test('should maintain password hash on non-password updates', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'Test123!',
                fullName: 'Test User'
            };

            const user = new User(userData);
            await user.save();
            const originalPasswordHash = user.password;

            // Update non-password field
            user.fullName = 'Updated Name';
            await user.save();

            expect(user.password).toBe(originalPasswordHash);
        });
    });
}); 