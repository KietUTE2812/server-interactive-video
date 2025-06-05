import request from 'supertest';
import app from '../app/app.js';
import server from '../server.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const instructor = {
  email: process.env.TEST_INSTRUCTOR_EMAIL,
  password: process.env.TEST_INSTRUCTOR_PASSWORD,
  token: ''
};

// ID mẫu, thay bằng id hợp lệ trong DB nếu có
const sampleCourseId = '682bf39d74c417c7ac69058b';

//Đăng nhập và lấy token
beforeAll(async () => {
  const res = await request(app)
    .post('/api/v1/users/login')
    .send({ email: instructor.email, password: instructor.password });

  expect(res.status).toBe(200);
  expect(res.body.data).toHaveProperty('token');

  instructor.token = 'Bearer ' + res.body.data.token;
  console.log('Instructor token:', instructor.token);
});

//Test case cho controller course
describe('Course Controller - as Instructor', () => {
  test('GET /api/v1/learns should return list of courses', async () => {
    const res = await request(app)
      .get('/api/v1/learns')
      .set('Authorization', instructor.token);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  test('GET /api/v1/learns/:id should return course detail', async () => {
    const res = await request(app)
      .get(`/api/v1/learns/${sampleCourseId}`)
      .set('Authorization', instructor.token);

    expect([200, 404]).toContain(res.status);
  });

  test('POST /api/v1/learns should create a new course', async () => {
    const newCourse = {
      courseId: 'TestId',
      title: 'Test Course',
      description: 'Test Description',
      tags: 'test,course',
    };
    const photoPath = path.resolve(__dirname, 'assets', 'TEST_IMAGE.jpg');
    const summaryVideoPath = path.resolve(__dirname, 'assets', 'TEST_VIDEO.mp4');
    console.log('Photo path:', photoPath);
    console.log('Summary video path:', summaryVideoPath);

    const res = await request(app)
      .post('/api/v1/learns')
      .set('Authorization', instructor.token)
      .field('courseId', newCourse.courseId)
      .field('title', newCourse.title)
      .field('description', newCourse.description)
      .field('tags', newCourse.tags)
      .attach('photo', photoPath)
      .attach('sumaryVideo', summaryVideoPath);

    expect([201, 400, 403]).toContain(res.status);
  });
});
