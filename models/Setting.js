import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema({
  homepage_banner: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    default: {
      listImageUrl: [], // Mảng các url ảnh
      link: '', // Link của banner
      title: '', // Tiêu đề của banner
    },
  },
  notification: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    default: {
        emailNotification: true, // Bật/tắt thông báo email
        notificationSound: true, // Bật/tắt âm thanh thông báo
        browserNotification: true, // Bật/tắt popup thông báo
      },
    },
    appearance: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {
        theme: 'light', // Chọn chế độ sáng/tối
        language: 'en', // Ngôn ngữ
      },
    },
    security: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {
        twoFactorAuth: false, // Bật/tắt 2FA
        autoLogout: 30, // Thời gian tự động đăng xuất
      },
    },
    email: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {
        emailSignature: 'Best regards, \nAdmin Team', // Chữ ký email
        copyAdminOnEmail: true, // Bật/tắt gửi email đến admin
      },
    },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const Setting = mongoose.model('Setting', settingSchema);

// Setting.create({
//   homepage_banner: {
//     listImageUrl: [],
//     link: '',
//     title: '',
//   },
//   notification: {
//     emailNotification: true,
//     notificationSound: true,
//     browserNotification: true,
//   },
//   appearance: {
//     theme: 'light',
//     language: 'en',
//   },
//   security: {
//     twoFactorAuth: false,
//     autoLogout: 30,
//   },
//   email: {
//     emailSignature: 'Best regards, \nAdmin Team',
//     copyAdminOnEmail: true,
//   },
// });

export default Setting;
