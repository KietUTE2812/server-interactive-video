import mongoose from 'mongoose';

const ShortLinkSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

const ShortLink = mongoose.model('ShortLink', ShortLinkSchema);

// ShortLink.create(
//     {
//         code: '456789123',
//         courseId: '664b38000000000000000000',
//         expiresAt: new Date(Date.now() - 60 * 60 * 1000),
//         createdBy: '664b38000000000000000000'
//     }
// )

export default ShortLink;
