// app.js
const store = require('./utils/store');
const { authApi } = require('./utils/api');

App({
  onLaunch: async function () {
    // 尝试恢复用户登录状态
    await this.restoreUserSession();

    // 启用分享功能（基础库 2.11.0 前需主动调用）
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline'],
    });
  },

  // 恢复用户会话
  async restoreUserSession() {
    try {
      const token = wx.getStorageSync('auth_token');
      if (token) {
        const user = await authApi.getCurrentUser();
        store.setUser(user);
      }
    } catch (error) {
      console.error('恢复用户会话失败:', error);
      // 清除过期的token
      wx.removeStorageSync('auth_token');
      wx.removeStorageSync('user_id');
    }
  },

  globalData: {
    apiUrl: 'http://localhost:8000/api/v1',
  },
});