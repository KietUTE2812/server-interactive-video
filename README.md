# Backend Interactive Video Platform

## Table of Contents

1. [Introduction](#introduction)
2. [System Architecture Overview](#system-architecture-overview)
3. [API Documentation](#api-documentation)
   - [User API](#user-api)
   - [Course API](#course-api)
   - [Payment API](#payment-api)
   - [Module API](#module-api)
   - [Quiz API](#quiz-api)
   - [Programming API](#programming-api)
   - [Review API](#review-api)
   - [Roadmap API](#roadmap-api)
   - [Progress API](#progress-api)
   - [Course Grade API](#course-grade-api)
   - [Search API](#search-api)
   - [Video API](#video-api)
   - [Notification API](#notification-api)
   - [Student API](#student-api)
   - [Chat API](#chat-api)
4. [Authentication](#authentication-details)
5. [Installation](#installation)
6. [Environment Setup](#environment-setup)

## Introduction

The Backend Interactive Video Platform is a comprehensive solution for online education, providing APIs for user management, course creation, interactive learning content, programming exercises, and more. This system supports features like livestreaming, quizzes, progress tracking, and roadmap-based learning paths.

## System Architecture Overview

This section summarizes the main controllers and routes in the system, providing a high-level view of the backend architecture.

### Controllers

- **userController**: Handles user registration, authentication (email, Google, Facebook, GitHub), profile management, password reset, user grouping, and admin user management.
- **courseController**: Manages course creation, listing, filtering, enrollment, module management, and approval workflow.
- **programController**: Provides endpoints for programming exercises, code compilation, submission, and result analytics.
- **notificationController**: Manages user notifications, including creation, delivery, and read status.
- **moduleItemController**: Handles course module items such as lectures, quizzes, programming exercises, and interactive content.
- **quizController**: Manages quiz creation, question management, attempts, and scoring.
- **categoryController**: Handles course categories (CRUD).
- **roadmapController**: Manages personalized learning paths and skill roadmaps.
- **progressController**: Tracks user progress through courses and modules.
- **courseGradeController**: Manages assignments, grading, and certificate generation.
- **searchController**: Provides advanced search for courses, tags, levels, and instructors.
- **videoController**: Handles video upload, storage, and playback tracking.
- **studentController**: Manages student-specific endpoints (enrollment, learning history).
- **chatbotController, conversationController, messageController**: Enable chat and messaging features.
- **shortLinkController**: Manages short links for sharing resources.
- **settingController**: Handles system settings and configuration.
- **uploadController**: Manages file uploads.
- **reviewController, courseReviewController**: Handle course reviews and ratings.
- **authController**: Provides authentication helpers and password verification.
- **recommendSystem**: Implements recommendation logic for personalized content.

### Routes

- **usersRoute**: User registration, login, profile, admin management, grouping.
- **courseRoute**: Course listing, details, enrollment, module management.
- **programRoute**: Programming problems, code execution, submission, analytics.
- **notificationRoute/notificationRoutes**: User notification endpoints.
- **moduleItemRoute**: CRUD for module items (lectures, quizzes, programming).
- **quizRoute**: Quiz endpoints.
- **categoryRoute**: Category management.
- **roadmapRoute**: Roadmap and learning path endpoints.
- **progressRoute**: Progress tracking.
- **courseGradeRoute**: Assignment and grading endpoints.
- **searchRoute**: Search endpoints for courses, tags, levels.
- **videoRoute**: Video management.
- **studentRoute**: Student-specific endpoints.
- **chatbotRoute, conversationRoute, messageRoute**: Chat and messaging.
- **shortLinkRoute**: Short link management.
- **settingRoute**: System settings.
- **authRoute/authRouteGithub/authRouteGoogle**: Authentication endpoints.
- **codespaceRoute**: Codespace management for coding environments.

## API Documentation

### User API

Base URL: `/api/v1/users`

The User API handles user authentication, profile management, and administration functions.

**Key Features:**
- User registration with email verification
- Multiple login methods (Email, Google, Facebook, GitHub)
- Password management (reset, change)
- Profile management
- User administration (for admin users)

[See detailed User API documentation](#user-api-routes)

### Course API

Base URL: `/api/v1/learns`

The Course API enables the creation, management, and consumption of courses.

**Key Features:**
- Course listing with filtering and searching
- Course creation and management
- Module and content organization
- Course enrollment
- Admin approval workflow

[See detailed Course API documentation](#course-api-routes)

### Payment API

Base URL: `/api/v1/payments`

The Payment API handles payment processing for course enrollment.

**Key Features:**
- Payment creation
- VNPay integration
- Payment history
- Receipt generation

### Module API

Base URL: `/api/v1/modules`

The Module API manages course modules and their content.

**Key Features:**
- Module creation and management
- Content organization
- Multiple content types (video, quiz, supplement, programming)

### Quiz API

Base URL: `/api/v1/quizzes`

The Quiz API provides functionality for creating and taking quizzes.

**Key Features:**
- Quiz creation
- Question management
- Quiz attempts and scoring
- Result analytics

### Programming API

Base URL: `/api/v1/problem`

The Programming API allows for creating programming exercises and evaluating submissions.

**Key Features:**
- Problem definition
- Code compilation and execution
- Test case validation
- Submission history
- Performance analytics

### Review API

Base URL: `/api/v1/reviews`

The Review API manages course reviews and ratings.

**Key Features:**
- Review submission
- Rating system
- Review moderation
- Reporting and filtering

### Roadmap API

Base URL: `/api/v1/roadmap`

The Roadmap API enables personalized learning paths.

**Key Features:**
- Learning roadmap creation
- Skill assessment
- Progress tracking
- Customized recommendations

### Progress API

Base URL: `/api/v1/progress`

The Progress API tracks user progress through courses and modules.

**Key Features:**
- Progress tracking for various content types
- Completion status
- Performance metrics
- Learning analytics

### Course Grade API

Base URL: `/api/v1/coursegrades`

The Course Grade API manages grading and assignments.

**Key Features:**
- Assignment creation
- Grade management
- Performance assessment
- Certificate generation

### Search API

Base URL: `/api/v1/search`

The Search API provides advanced search capabilities.

**Key Features:**
- Course search with filters
- Tag-based search
- Level-based filtering
- Instructor search

### Video API

Base URL: `/api/v1/videos`

The Video API handles video content management.

**Key Features:**
- Video upload and storage
- Playback tracking
- Interactive elements
- Video processing

### Notification API

Base URL: `/api/v1/notifications`

The Notification API manages user notifications.

**Key Features:**
- Notification creation
- Delivery management
- Read status tracking
- Preference settings

### Student API

Base URL: `/api/v1/student`

The Student API focuses on student-specific functionality.

**Key Features:**
- Enrollment management
- Course access
- Learning history
- Performance analysis

### Chat API

Base URL: `/api/v1/conversations`, `/api/v1/messages`

The Chat API enables communication between users.

**Key Features:**
- Conversation management
- Message exchange
- User presence
- Notification integration

### User API Routes

Base URL: `/api/v1/users`

#### Authentication Endpoints

##### Register User
- **Route**: `POST /api/v1/users/register`
- **Description**: Creates a new user account
- **Access**: Public
- **Request Body**:
  ```json
  {
    "username": "johndoe",
    "email": "johndoe@example.com",
    "password": "Abcd1234!",
    "fullname": "John Doe"
  }
  ```
- **Password Requirements**:
  - At least 8 characters
  - At least one lowercase letter
  - At least one uppercase letter
  - At least one number
  - At least one special character
- **Response**:
  - Success (201):
    ```json
    {
      "status": "success",
      "message": "User created successfully. Please check your email for verification code.",
      "data": {
        "userId": "8a8e1a2b-4c7d-4ae3-9f5d-3e4b2c1a",
        "username": "johndoe",
        "email": "johndoe@example.com",
        "profile": {
          "fullname": "John Doe"
        },
        "role": "student",
        "status": "inactive"
      }
    }
    ```
  - Error (400):
    ```json
    {
      "status": "error",
      "message": "Email already registered"
    }
    ```

##### Verify Account
- **Route**: `POST /api/v1/users/verify-account`
- **Description**: Verifies a newly created account using a code sent via email
- **Access**: Public
- **Request Body**:
  ```json
  {
    "email": "johndoe@example.com",
    "code": "123456"
  }
  ```
- **Response**:
  - Success (200):
    ```json
    {
      "status": "success",
      "message": "Verify account successfully"
    }
    ```
  - Error (400):
    ```json
    {
      "status": "error",
      "message": "Invalid verification code"
    }
    ```

##### Login
- **Route**: `POST /api/v1/users/login`
- **Description**: Authenticates a user and returns tokens
- **Access**: Public
- **Request Body** (Regular Login):
  ```json
  {
    "email": "johndoe@example.com",
    "password": "Abcd1234!"
  }
  ```
- **Request Body** (Google Login):
  ```json
  {
    "isGoogle": true,
    "email": "johndoe@example.com",
    "googleId": "12345678901234567890",
    "picture": "https://example.com/profile.jpg",
    "fullname": "John Doe"
  }
  ```
- **Request Body** (Facebook Login):
  ```json
  {
    "isFacebook": true,
    "email": "johndoe@example.com",
    "facebookId": "12345678901234567890",
    "picture": "https://example.com/profile.jpg",
    "fullname": "John Doe"
  }
  ```
- **Response**:
  - Success (200):
    ```json
    {
      "status": "success",
      "message": "Login successfully",
      "data": {
        "user": {
          "userId": "8a8e1a2b-4c7d-4ae3-9f5d-3e4b2c1a",
          "username": "johndoe",
          "email": "johndoe@example.com",
          "profile": {
            "fullname": "John Doe",
            "picture": "https://example.com/profile.jpg"
          },
          "role": "student",
          "status": "active"
        },
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      }
    }
    ```
  - Error (401):
    ```json
    {
      "status": "error",
      "message": "Invalid credentials"
    }
    ```

##### Logout
- **Route**: `POST /api/v1/users/logout`
- **Description**: Logs out a user by clearing refresh token
- **Access**: Private
- **Headers**:
  - `Authorization`: `Bearer ${token}`
- **Response**:
  - Success (200):
    ```json
    {
      "status": "success",
      "message": "Logout successfully"
    }
    ```
  - Error (400):
    ```json
    {
      "status": "error",
      "message": "No active session found"
    }
    ```

##### Refresh Access Token
- **Route**: `POST /api/v1/users/reset-access-token`
- **Description**: Generates a new access token using refresh token
- **Access**: Public
- **Cookies Required**: `refreshToken`
- **Response**:
  - Success (200):
    ```json
    {
      "status": "success",
      "message": "Access token refreshed successfully",
      "data": {
        "newToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      }
    }
    ```
  - Error (401):
    ```json
    {
      "status": "error",
      "message": "Authentication required. Please login."
    }
    ```

##### Forgot Password
- **Route**: `POST /api/v1/users/forgot-password`
- **Description**: Sends a password reset code to user's email
- **Access**: Public
- **Request Body**:
  ```json
  {
    "email": "johndoe@example.com"
  }
  ```
- **Response**:
  - Success (200):
    ```json
    {
      "status": "success",
      "message": "Password reset code sent to email!"
    }
    ```
  - Error (404):
    ```json
    {
      "status": "error",
      "message": "There is no user with that email"
    }
    ```

##### Reset Password
- **Route**: `POST /api/v1/users/reset-password`
- **Description**: Resets user password using verification code
- **Access**: Public
- **Request Body**:
  ```json
  {
    "code": "123456",
    "password": "NewPassword123!"
  }
  ```
- **Response**:
  - Success (200):
    ```json
    {
      "status": "success",
      "message": "Password reset successful!",
      "data": {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      }
    }
    ```
  - Error (400):
    ```json
    {
      "status": "error",
      "message": "Reset code is invalid or has expired"
    }
    ```

#### User Profile Management

##### Get User Profile
- **Route**: `GET /api/v1/users/:userid`
- **Description**: Retrieves a user's profile information
- **Access**: Private
- **Headers**:
  - `Authorization`: `Bearer ${token}`
- **Response**:
  - Success (200):
    ```json
    {
      "status": "success",
      "message": "Get user profile successfully",
      "data": {
        "userId": "8a8e1a2b-4c7d-4ae3-9f5d-3e4b2c1a",
        "profile": {
          "fullname": "John Doe",
          "bio": "Software Engineer",
          "picture": "https://example.com/profile.jpg",
          "phone": "1234567890"
        },
        "username": "johndoe",
        "email": "johndoe@example.com",
        "role": "student",
        "status": "active",
        "enrolled_courses": [
          {
            "_id": "60d21b4967d0d8992e610c85",
            "title": "JavaScript Fundamentals"
          }
        ]
      }
    }
    ```
  - Error (404):
    ```json
    {
      "status": "error",
      "message": "User not found"
    }
    ```

##### Update User Profile
- **Route**: `PUT /api/v1/users/:userid`
- **Description**: Updates a user's profile information
- **Access**: Private
- **Headers**:
  - `Authorization`: `Bearer ${token}`
- **Content-Type**: `multipart/form-data`
- **Request Body**:
  ```
  fullname: John Doe Updated
  bio: Software Engineer & Technical Writer
  phone: 9876543210
  avatar: [file upload]
  ```
- **Response**:
  - Success (200):
    ```json
    {
      "status": "success",
      "message": "Profile updated successfully",
      "data": {
        "userId": "8a8e1a2b-4c7d-4ae3-9f5d-3e4b2c1a",
        "profile": {
          "fullname": "John Doe Updated",
          "bio": "Software Engineer & Technical Writer",
          "picture": "https://cloudinary.com/updated_profile.jpg",
          "phone": "9876543210"
        },
        "username": "johndoe",
        "email": "johndoe@example.com",
        "role": "student",
        "status": "active"
      }
    }
    ```
  - Error (403):
    ```json
    {
      "status": "error",
      "message": "Not authorized to update this profile"
    }
    ```

##### Delete User
- **Route**: `DELETE /api/v1/users/:userid`
- **Description**: Soft deletes a user account (sets status to 'removed')
- **Access**: Private
- **Headers**:
  - `Authorization`: `Bearer ${token}`
- **Response**:
  - Success (200):
    ```json
    {
      "status": "success",
      "message": "User removed successfully"
    }
    ```
  - Error (404):
    ```json
    {
      "status": "error",
      "message": "User not found"
    }
    ```

#### Admin User Management

##### Get All Users
- **Route**: `GET /api/v1/users?limit=10&page=1&email=search&fullname=search&role=student`
- **Description**: Retrieves a list of users with filtering and pagination
- **Access**: Private/Admin/Instructor
- **Headers**:
  - `Authorization`: `Bearer ${token}`
- **Query Parameters**:
  - `limit`: Number of users per page (default: 10)
  - `page`: Page number (default: 1)
  - `email`: Filter by email (optional)
  - `fullname`: Filter by fullname (optional)
  - `username`: Filter by username (optional)
  - `role`: Filter by role (optional, e.g., 'student', 'instructor', 'admin')
  - `status`: Filter by status (optional, e.g., 'active', 'inactive', 'removed')
  - `courseId`: Filter by enrolled course ID (optional)
- **Response**:
  - Success (200):
    ```json
    {
      "status": "success",
      "total": 50,
      "page": 1,
      "limit": 10,
      "totalPages": 5,
      "data": {
        "users": [
          {
            "_id": "60d21b4967d0d8992e610c85",
            "profile": {
              "fullname": "John Doe",
              "picture": "https://example.com/profile.jpg"
            },
            "username": "johndoe",
            "email": "johndoe@example.com",
            "role": "student",
            "status": "active"
          },
          // ... more users
        ]
      }
    }
    ```
  - Error (403):
    ```json
    {
      "status": "error",
      "message": "Access limited for non-admin users"
    }
    ```

##### Update User By Admin
- **Route**: `PUT /api/v1/users/update-by-admin/:userid`
- **Description**: Allows an admin to update any user's profile
- **Access**: Private/Admin
- **Headers**:
  - `Authorization`: `Bearer ${token}`
- **Content-Type**: `multipart/form-data`
- **Request Body**:
  ```
  userId: 60d21b4967d0d8992e610c85
  fullname: John Doe
  bio: Software Engineer
  phone: 1234567890
  status: active
  role: instructor
  avatar: [file upload]
  ```
- **Response**:
  - Success (200):
    ```json
    {
      "status": "success",
      "message": "User updated successfully by admin",
      "data": {
        "userId": "8a8e1a2b-4c7d-4ae3-9f5d-3e4b2c1a",
        "profile": {
          "fullname": "John Doe",
          "bio": "Software Engineer",
          "picture": "https://cloudinary.com/updated_profile.jpg",
          "phone": "1234567890"
        },
        "username": "johndoe",
        "email": "johndoe@example.com",
        "role": "instructor",
        "status": "active"
      }
    }
    ```
  - Error (404):
    ```json
    {
      "status": "error",
      "message": "User to update not found"
    }
    ```

### Course API Routes

Base URL: `/api/v1/learns`

#### Course Listing and General Access

##### Get All Courses
- **Route**: `GET /api/v1/learns`
- **Description**: Retrieves a list of courses with filtering, sorting, and pagination
- **Access**: Private (All authenticated users)
- **Headers**:
  - `Authorization`: `Bearer ${token}`
- **Query Parameters**:
  - `search`: Search by title, tags, or instructor name (optional)
  - `tags`: Filter by specific tags (comma separated) (optional)
  - `level`: Filter by course level (optional, e.g., 'beginner', 'intermediate', 'advanced')
  - `limit`: Number of courses per page (default: 10)
  - `page`: Page number (default: 1)
  - `orderBy`: Sort order ('newest' or 'topRated', default: 'newest')
- **Response**:
  - Success (200):
    ```json
    {
      "success": true,
      "page": 1,
      "limit": 10,
      "totalPages": 5,
      "total": 50,
      "data": [
        {
          "_id": "60d21b4967d0d8992e610c85",
          "title": "Introduction to JavaScript",
          "description": "Learn JavaScript from scratch",
          "level": "beginner",
          "price": 49.99,
          "tags": ["javascript", "web development", "programming"],
          "averageRating": 4.7,
          "instructor": {
            "_id": "60d21b4967d0d8992e610c80",
            "profile": {
              "fullname": "John Smith",
              "picture": "https://example.com/profile.jpg"
            },
            "email": "john@example.com"
          },
          "photo": "https://example.com/course-cover.jpg",
          "courseId": "JS-101"
        },
        // More courses...
      ]
    }
    ```

##### Get Course Details
- **Route**: `GET /api/v1/learns/:id`
- **Description**: Retrieves detailed information about a specific course
- **Access**: Private (All authenticated users)
- **Headers**:
  - `Authorization`: `Bearer ${token}`
- **Response**:
  - Success (200):
    ```json
    {
      "success": true,
      "isEnrolled": true,
      "enrollments": 42,
      "data": {
        "_id": "60d21b4967d0d8992e610c85",
        "title": "Introduction to JavaScript",
        "description": "Learn JavaScript from scratch",
        "level": "beginner",
        "price": 49.99,
        "tags": ["javascript", "web development", "programming"],
        "averageRating": 4.7,
        "instructor": {
          "_id": "60d21b4967d0d8992e610c80",
          "profile": {
            "fullname": "John Smith",
            "picture": "https://example.com/profile.jpg"
          },
          "email": "john@example.com"
        },
        "modules": [
          {
            "_id": "60d21b4967d0d8992e610c86",
            "index": 1,
            "title": "Getting Started",
            "description": "Introduction to JavaScript basics",
            "moduleItems": [
              {
                "_id": "60d21b4967d0d8992e610c87",
                "title": "Variables and Data Types",
                "type": "lecture"
              }
              // More module items...
            ]
          }
          // More modules...
        ],
        "status": "published",
        "isApproved": true,
        "approvedBy": {
          "_id": "60d21b4967d0d8992e610c81",
          "email": "admin@example.com",
          "profile": {
            "fullname": "Admin User"
          }
        },
        "sumaryVideo": "https://example.com/course-intro.mp4",
        "photo": "https://example.com/course-cover.jpg",
        "courseId": "JS-101",
        "created_at": "2023-01-01T00:00:00.000Z"
      }
    }
    ```
  - Error (404):
    ```json
    {
      "success": false,
      "message": "Course not found with id of 60d21b4967d0d8992e610c85"
    }
    ```

#### Student-Specific Routes

##### Enroll in a Course
- **Route**: `POST /api/v1/learns/enroll/:courseId`
- **Description**: Enrolls a student in a course
- **Access**: Private (Students only)
- **Headers**:
  - `Authorization`: `Bearer ${token}`
- **Response**:
  - Success (200):
    ```json
    {
      "success": true,
      "message": "Successfully enrolled in the course",
      "data": {
        "courseId": "60d21b4967d0d8992e610c85",
        "enrolledAt": "2023-06-01T00:00:00.000Z",
        "status": "active"
      }
    }
    ```
  - Error (400):
    ```json
    {
      "success": false,
      "message": "Already enrolled in this course"
    }
    ```

##### Get My Enrolled Courses
- **Route**: `GET /api/v1/learns/my-learning`
- **Description**: Retrieves all courses the user has enrolled in
- **Access**: Private (Students and Admin)
- **Headers**:
  - `Authorization`: `Bearer ${token}`
- **Response**:
  - Success (200):
    ```json
    {
      "success": true,
      "count": 3,
      "data": [
        {
          "_id": "60d21b4967d0d8992e610c85",
          "title": "Introduction to JavaScript",
          "description": "Learn JavaScript from scratch",
          "level": "beginner",
          "price": 49.99,
          "instructor": {
            "_id": "60d21b4967d0d8992e610c80",
            "profile": {
              "fullname": "John Smith"
            },
            "email": "john@example.com"
          },
          "photo": "https://example.com/course-cover.jpg",
          "courseId": "JS-101",
          "progress": {
            "overallPercentage": 65,
            "status": "in-progress",
            "moduleDetails": [
              {
                "moduleId": "60d21b4967d0d8992e610c86",
                "completionPercentage": 100
              },
              {
                "moduleId": "60d21b4967d0d8992e610c88",
                "completionPercentage": 30
              }
              // More modules...
            ]
          }
        },
        // More courses...
      ]
    }
    ```

#### Instructor-Specific Routes

##### Get Instructor's Courses
- **Route**: `GET /api/v1/learns/instructor`
- **Description**: Retrieves all courses created by the authenticated instructor
- **Access**: Private (Instructors and Admin)
- **Headers**:
  - `Authorization`: `Bearer ${token}`
- **Response**:
  - Success (200):
    ```json
    {
      "success": true,
      "count": 5,
      "data": [
        {
          "_id": "60d21b4967d0d8992e610c85",
          "title": "Introduction to JavaScript",
          "description": "Learn JavaScript from scratch",
          "level": "beginner",
          "price": 49.99,
          "tags": ["javascript", "web development", "programming"],
          "averageRating": 4.7,
          "status": "published",
          "isApproved": true,
          "courseId": "JS-101",
          "photo": "https://example.com/course-cover.jpg",
          "created_at": "2023-01-01T00:00:00.000Z"
        },
        // More courses...
      ]
    }
    ```

##### Create New Course
- **Route**: `POST /api/v1/learns`
- **Description**: Creates a new course
- **Access**: Private (Instructors and Admin)
- **Headers**:
  - `Authorization`: `Bearer ${token}`
- **Content-Type**: `multipart/form-data`
- **Request Body**:
  ```
  title: Introduction to React
  description: Learn React from scratch
  level: intermediate
  price: 59.99
  tags: react,javascript,frontend
  sumaryVideo: [file upload]
  photo: [file upload]
  ```
- **Response**:
  - Success (201):
    ```json
    {
      "success": true,
      "data": {
        "_id": "60d21b4967d0d8992e610c90",
        "title": "Introduction to React",
        "description": "Learn React from scratch",
        "level": "intermediate",
        "price": 59.99,
        "tags": ["react", "javascript", "frontend"],
        "instructor": "60d21b4967d0d8992e610c80",
        "status": "draft",
        "isApproved": false,
        "sumaryVideo": "https://example.com/react-intro.mp4",
        "photo": "https://example.com/react-cover.jpg",
        "courseId": "REACT-101",
        "created_at": "2023-06-01T00:00:00.000Z"
      }
    }
    ```
  - Error (400):
    ```json
    {
      "success": false,
      "message": "Title is required"
    }
    ```

##### Update Course
- **Route**: `PUT /api/v1/learns/:id`
- **Description**: Updates course information
- **Access**: Private (Course owner instructor or Admin)
- **Headers**:
  - `Authorization`: `Bearer ${token}`
- **Content-Type**: `multipart/form-data`
- **Request Body**:
  ```
  title: Advanced React Concepts
  description: Master advanced React patterns and techniques
  level: advanced
  price: 79.99
  tags: react,javascript,advanced
  sumaryVideo: [file upload]
  ```
- **Response**:
  - Success (200):
    ```json
    {
      "success": true,
      "data": {
        "_id": "60d21b4967d0d8992e610c90",
        "title": "Advanced React Concepts",
        "description": "Master advanced React patterns and techniques",
        "level": "advanced",
        "price": 79.99,
        "tags": ["react", "javascript", "advanced"],
        "instructor": "60d21b4967d0d8992e610c80",
        "modules": [
          // Course modules...
        ]
      }
    }
    ```
  - Error (403):
    ```json
    {
      "status": "error",
      "message": "You are not authorized to access this course"
    }
    ```

##### Delete Course
- **Route**: `DELETE /api/v1/learns/:id`
- **Description**: Deletes a course (soft delete - changes status to 'deleted')
- **Access**: Private (Course owner instructor or Admin)
- **Headers**:
  - `Authorization`: `Bearer ${token}`
- **Response**:
  - Success (200):
    ```json
    {
      "success": true,
      "message": "Course deleted successfully"
    }
    ```
  - Error (403):
    ```json
    {
      "status": "error",
      "message": "You are not authorized to access this course"
    }
    ```

#### Admin-Specific Routes

##### Approve Course
- **Route**: `PUT /api/v1/learns/:id/approve`
- **Description**: Approves a course for publication
- **Access**: Private (Admin only)
- **Headers**:
  - `Authorization`: `Bearer ${token}`
- **Response**:
  - Success (200):
    ```json
    {
      "success": true,
      "data": {
        "_id": "60d21b4967d0d8992e610c90",
        "title": "Advanced React Concepts",
        "isApproved": true,
        "approvedBy": "60d21b4967d0d8992e610c81",
        // Other course data...
      }
    }
    ```
  - Error (403):
    ```json
    {
      "status": "error",
      "message": "User 60d21b4967d0d8992e610c80 is not authorized to approve courses"
    }
    ```

#### Module Management

##### Get Course Modules
- **Route**: `GET /api/v1/learns/:id/modules`
- **Description**: Retrieves all modules for a specific course
- **Access**: Private (All authenticated users)
- **Headers**:
  - `Authorization`: `Bearer ${token}`
- **Response**:
  - Success (200):
    ```json
    {
      "success": true,
      "data": [
        {
          "_id": "60d21b4967d0d8992e610c86",
          "index": 1,
          "title": "Getting Started",
          "description": "Introduction to course basics",
          "courseId": "60d21b4967d0d8992e610c85",
          "moduleItems": [
            {
              "_id": "60d21b4967d0d8992e610c87",
              "title": "Welcome to the Course",
              "type": "lecture"
            }
            // More module items...
          ]
        },
        // More modules...
      ]
    }
    ```

##### Create Module
- **Route**: `POST /api/v1/learns/:id/modules`
- **Description**: Creates a new module for a course
- **Access**: Private (Course owner instructor or Admin)
- **Headers**:
  - `Authorization`: `Bearer ${token}`
- **Request Body**:
  ```json
  {
    "title": "Advanced Topics",
    "description": "Explore advanced concepts",
    "index": 3
  }
  ```
- **Response**:
  - Success (201):
    ```json
    {
      "success": true,
      "data": {
        "_id": "60d21b4967d0d8992e610c89",
        "title": "Advanced Topics",
        "description": "Explore advanced concepts",
        "index": 3,
        "courseId": "60d21b4967d0d8992e610c85",
        "moduleItems": []
      }
    }
    ```


#### Course Content Management

##### Create Quiz Module Item
- **Route**: `POST /api/v1/learns/:id/modules/:moduleId/quiz`
- **Description**: Creates a new quiz in a module
- **Access**: Private (Course owner instructor or Admin)
- **Headers**:
  - `Authorization`: `Bearer ${token}`
- **Request Body**:
  ```json
  {
    "title": "JavaScript Fundamentals Quiz",
    "description": "Test your understanding of JavaScript basics",
    "timeLimit": 15,
    "passingScore": 70,
    "questions": [
      {
        "question": "What is the output of console.log(typeof [])?",
        "options": ["array", "object", "undefined", "null"],
        "correctAnswer": 1,
        "points": 10
      }
      // More questions...
    ]
  }
  ```

##### Create Lecture Module Item
- **Route**: `POST /api/v1/learns/:id/modules/:moduleId/lecture`
- **Description**: Creates a new lecture in a module
- **Access**: Private (Course owner instructor or Admin)
- **Headers**:
  - `Authorization`: `Bearer ${token}`
- **Content-Type**: `multipart/form-data`
- **Request Body**:
  ```
  title: Variables and Data Types
  description: Learn about JavaScript variables and data types
  file: [video file upload]
  ```

##### Create Programming Exercise Module Item
- **Route**: `POST /api/v1/learns/:id/modules/:moduleId/programming`
- **Description**: Creates a new programming exercise in a module
- **Access**: Private (Course owner instructor or Admin)
- **Headers**:
  - `Authorization`: `Bearer ${token}`
- **Request Body**:
  ```json
  {
    "title": "Implement a Binary Search",
    "description": "Create a function that performs binary search on a sorted array",
    "instructions": "Write a function called binarySearch that takes a sorted array and a target value...",
    "language": "javascript",
    "timeLimit": 5000,
    "memoryLimit": 512,
    "testCases": [
      {
        "input": "[1, 2, 3, 4, 5], 3",
        "expectedOutput": "2"
      }
      // More test cases...
    ]
  }
  ```

#### Course Status and Permissions

##### Course Status Values
- **draft**: Initial state, visible only to instructor and admins
- **published**: Available for enrollment but may require approval
- **deleted**: Soft-deleted, not visible to students

##### Course Access Permissions
- **Students**: Can view published and approved courses, enroll, and access content of enrolled courses
- **Instructors**: Can create, update, and delete their own courses and content
- **Admins**: Full access to all courses and administrative functions like approving courses

#### Authentication Details

##### JWT Authentication
- The API uses JWT (JSON Web Tokens) for authentication
- Two types of tokens are used:
  1. **Access Token**: Short-lived token for API access
  2. **Refresh Token**: Long-lived token (3 days) stored in HTTP-only cookie

##### Token Format
- **Authorization Header**: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Cookie**: `refreshToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

##### User Roles and Permissions
- **student**: Regular user with access to courses and learning materials
- **instructor**: Can create and manage courses, modules, and course content
- **admin**: Full access to all resources and user management

##### Account Status
- **inactive**: Newly registered account, email not verified
- **active**: Verified active account
- **removed**: Soft-deleted account
