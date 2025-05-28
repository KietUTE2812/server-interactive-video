import ShortLink from '../models/ShortLink.js';
import { nanoid } from 'nanoid';
import asyncHandler from '../middlewares/asyncHandler.js';

// Tạo short link mới
export const createShortLink = asyncHandler(async (req, res) => {
  try {
    let { courseId, expiresAt } = req.body;
    console.log(courseId, expiresAt);
    if (!courseId) return res.status(400).json({ success: false, error: 'Course ID is required' });
    if (!expiresAt){
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 ngày
    };
    const code = nanoid(8);
    const createdBy = req.user ? req.user._id : null;
    const shortLink = await ShortLink.create({ code, courseId, expiresAt, createdBy });
    res.status(201).json({ success: true, data: shortLink });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Lấy thông tin short link theo code
export const getShortLink = asyncHandler(async (req, res) => {
  try {
    const { code } = req.params;
    const shortLink = await ShortLink.findOne({ code }).populate('courseId').populate('createdBy');
    if (!shortLink) return res.status(404).json({ success: false, error: 'Short link not found' });
    res.json({ success: true, data: shortLink });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Chuyển hướng short link
export const redirectShortLink = asyncHandler(async (req, res) => {
  try {
    const { code } = req.params;
    const shortLink = await ShortLink.findOne({ code });
    if (!shortLink) return res.status(404).json({ success: false, error: 'Short link not found' });
    if (shortLink.expiresAt && shortLink.expiresAt < new Date()) {
      return res.status(410).json({ success: false, error: 'Short link expired' });
    }
    // Ví dụ: chuyển hướng đến trang chi tiết khóa học
    return res.redirect(`/courses/${shortLink.courseId}`);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Lấy tất cả short link (có thể lọc theo user)
export const getAllShortLinks = asyncHandler(async (req, res) => {
  try {
    const filter = req.user ? { createdBy: req.user._id } : {};
    const shortLinks = await ShortLink.find(filter).populate('courseId').populate('createdBy');
    res.json({ success: true, data: shortLinks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Xóa short link
export const deleteShortLink = asyncHandler(async (req, res) => {
  try {
    const { code } = req.params;
    const shortLink = await ShortLink.findOneAndDelete({ code });
    if (!shortLink) return res.status(404).json({ success: false, error: 'Short link not found' });
    res.json({ success: true, message: 'Short link deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default { createShortLink, getShortLink, redirectShortLink, getAllShortLinks, deleteShortLink };
