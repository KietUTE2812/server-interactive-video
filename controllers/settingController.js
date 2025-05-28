import Setting from '../models/Setting.js';
import GCS  from "../utils/ggCloudUpload.js";
const { uploadToGCS } = GCS;

// Lấy tất cả settings (chỉ nên có 1 document setting duy nhất)
export const getSettings = async (req, res) => {
  try {
    const settings = await Setting.findOne();
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cập nhật settings (update từng phần hoặc toàn bộ)
export const updateSettings = async (req, res) => {
  const { homepage_banner, notification, appearance, security, email } = req.body;
  const setting = await Setting.findOne();
  if (!setting) {
    return res.status(404).json({ message: 'Setting not found' });
  }
  if (homepage_banner) {
    setting.homepage_banner = homepage_banner;
  }
  if (notification) {
    setting.notification = notification;
  }
  if (appearance) {
    setting.appearance = appearance;
  }
  if (security) {
    setting.security = security;
  }
  if (email) {
    setting.email = email;
  }
  await setting.save();
  res.json(setting);
};

// Lấy 1 loại setting cụ thể (ví dụ: homepage_banner, notification, ...)
export const getSettingByType = async (req, res) => {
  try {
    const { type } = req.params;
    const settings = await Setting.findOne();
    if (!settings || !settings[type]) {
      return res.status(404).json({ message: 'Setting type not found' });
    }
    res.json({ [type]: settings[type] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cập nhật 1 loại setting cụ thể
export const updateSettingByType = async (req, res) => {
  try {
    const { type } = req.params;
    let settings = await Setting.findOne();
    if (!settings) {
      settings = new Setting({ [type]: req.body });
    } else {
      settings[type] = req.body;
      settings.updatedAt = Date.now();
    }
    await settings.save();
    res.json({ [type]: settings[type] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Xóa toàn bộ settings (nên hạn chế sử dụng)
export const deleteSettings = async (req, res) => {
  try {
    await Setting.deleteMany();
    res.json({ message: 'All settings deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
