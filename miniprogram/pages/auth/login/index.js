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

  // 微信授权获取手机号（新版API）
  async onGetPhoneNumber(e) {
    const { code } = e.detail; // 新版只需要code

    // 防止重复点击（2秒内只能点击一次）
    const now = Date.now();
    if (now - this.data.lastClickTime < 2000) {
      console.log('防止重复点击，请稍候再试');
      return;
    }
    this.setData({ lastClickTime: now });

    if (!code) {
      // 用户取消授权
      this.setData({ 
        error: '您取消了授权，请重新点击授权按钮',
        isLoading: false 
      });
      return;
    }

    this.setData({ isLoading: true, error: null });

    try {
      console.log('开始微信登录，手机号code:', code);
      
      // 调用后端API进行微信授权登录（新版API）
      const response = await authApi.wechatPhoneLogin(code);
      
      console.log('登录成功，响应:', response);
      
      // 保存session_id（从响应的cookie或返回值获取）
      const sessionId = response.session_id || response.id;
      
      wx.setStorageSync('auth_token', sessionId);  // 保存session_id
      wx.setStorageSync('user_id', response.id);   // 保存user_id
      
      // 确保user对象有id字段用于登录状态检查
      store.setUser({
        id: response.id,
        phone: response.phone,
        is_guest: response.is_guest || false,
        username: response.username
      });

      wx.showToast({
        title: '登录成功',
        icon: 'success',
      });

      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 500);
    } catch (error) {
      console.error('登录失败:', error);
      
      let errorMsg = '登录失败，请重试';
      
      // 根据错误信息提供友好提示
      if (error.message.includes('授权码已失效') || error.message.includes('invalid code')) {
        errorMsg = '授权码已失效，请重新点击授权按钮';
      } else if (error.message.includes('授权码已被使用')) {
        errorMsg = '授权码已被使用，请重新授权';
      } else if (error.message.includes('未开通手机号登录权限')) {
        errorMsg = '小程序未开通手机号登录权限，请联系管理员';
      } else if (error.message.includes('AppID无效')) {
        errorMsg = '小程序配置错误，请联系管理员';
      } else if (error.message.includes('微信登录失败')) {
        errorMsg = error.message;
      }
      
      this.setData({
        error: errorMsg,
        isLoading: false,
      });
    }
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
