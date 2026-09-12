const mongoose = require('mongoose');
const { success, fail } = require('@college-erp/shared-utils');

const getThemeConfig = async (req, res) => {
  try {
    let settings = null;
    if (mongoose.connection.db) {
      settings = await mongoose.connection.db
        .collection('institution_settings')
        .findOne({ key: 'global_theme' });
    }

    const defaultData = {
      institution: { name: 'College ERP', logoUrl: '', faviconUrl: '' },
      colors: { primary: '#4f46e5', secondary: '#06b6d4' }
    };

    res.status(200).json(settings?.data || defaultData);
  } catch (err) {
    console.error('[SettingsController] Failed to get theme:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

const updateThemeConfig = async (req, res) => {
  try {
    const payload = req.body;
    if (mongoose.connection.db) {
      await mongoose.connection.db.collection('institution_settings').updateOne(
        { key: 'global_theme' },
        { $set: { key: 'global_theme', data: payload, updatedAt: new Date() } },
        { upsert: true }
      );
    }
    res.status(200).json(payload);
  } catch (err) {
    console.error('[SettingsController] Failed to update theme:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = {
  getThemeConfig,
  updateThemeConfig
};
