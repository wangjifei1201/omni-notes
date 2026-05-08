// pages/auth/login/index.js
const { authApi } = require('../../../utils/api');
const store = require('../../../utils/store');

Page({
  data: {
    isLoading: false,
    error: null,
    lastClickTime: 0, // 上次点击时间
  },

  onLoad() {
    // 页面加载
  },

  // 微信授权登录（openid 方案）
  onWechatLogin() {
    // 防止重复点击（2秒内只能点击一次）
    const now = Date.now();
    if (now - this.data.lastClickTime < 2000) {
      console.log('防止重复点击，请稍候再试');
      return;
    }
    this.setData({ lastClickTime: now, isLoading: true, error: null });

    // 调用 wx.login 获取 code
    wx.login({
      success: (loginRes) => {
        if (!loginRes.code) {
          this.setData({ isLoading: false, error: '获取授权失败，请重试' });
          return;
        }

        console.log('微信登录 code:', loginRes.code);

        // 发送 code 到后端
        authApi.wechatLogin(loginRes.code)
          .then((response) => {
            console.log('登录成功，响应:', response);

            // 保存 session_id
            const sessionId = response.session_id || response.id;
            wx.setStorageSync('auth_token', sessionId);
            wx.setStorageSync('user_id', response.id);

            // 更新全局状态
            store.setUser({
              id: response.id,
              openid: response.openid,
              is_guest: response.is_guest || false,
              username: response.username
            });

            wx.showToast({ title: '登录成功', icon: 'success' });

            setTimeout(() => {
              wx.switchTab({ url: '/pages/index/index' });
            }, 500);
          })
          .catch((error) => {
            console.error('登录失败:', error);
            this.setData({
              error: error.message || '登录失败，请重试',
              isLoading: false,
            });
          });
      },
      fail: (err) => {
        console.error('wx.login 失败:', err);
        this.setData({ isLoading: false, error: '微信授权失败，请重试' });
      }
    });
  },

  // 游客登录
  async onGuestLogin() {
    this.setData({ isLoading: true, error: null });

    try {
      const user = await authApi.createGuest();
      
      wx.setStorageSync('auth_token', user.id);  // 游客模式的session_id就是user.id
      wx.setStorageSync('user_id', user.id);
      
      store.setUser({
        id: user.id,
        is_guest: true
      });

      wx.showToast({
        title: '游客登录成功',
        icon: 'success',
      });

      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 500);
    } catch (error) {
      this.setData({
        error: error.message || '游客登录失败，请重试',
        isLoading: false,
      });
    }
  },
});
