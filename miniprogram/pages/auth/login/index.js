// pages/auth/login/index.js
const { authApi } = require('../../../utils/api');
const store = require('../../../utils/store');

Page({
  data: {
    isLoading: false,
    error: null,
    lastClickTime: 0, // 上次点击时间
    acceptedAgreement: false,
  },

  onLoad() {
    // 页面加载
  },

  // 用户必须主动勾选协议后才能继续登录
  ensureAgreementAccepted() {
    if (this.data.acceptedAgreement) return true;

    this.setData({ error: '请先阅读并勾选同意《用户服务协议》及《隐私政策》' });
    wx.showToast({
      title: '请先同意协议',
      icon: 'none',
    });
    return false;
  },

  onAgreementChange(e) {
    const values = e.detail.value || [];
    this.setData({
      acceptedAgreement: values.includes('accepted'),
      error: null,
    });
  },

  openUserAgreement() {
    wx.showModal({
      title: '用户服务协议',
      content: '欢迎使用 Omni-Notes。\n\n1. 本服务用于视频内容解析、摘要生成、要点提取和历史记录管理。\n2. 你应确保提交的视频链接来源合法，不得利用本服务处理违法违规内容。\n3. AI 生成内容仅供参考，请自行判断其准确性和适用性。\n4. 你可以选择微信登录、邮箱登录或游客模式使用本服务。\n5. 继续使用前，请同时阅读并同意《隐私政策》。',
      showCancel: false,
      confirmText: '我已阅读',
    });
  },

  openPrivacyPolicy() {
    wx.showPrivacyContract({
      fail: () => {
        wx.showModal({
          title: '隐私政策',
          content: '请在小程序隐私保护指引中查看并确认隐私政策。',
          showCancel: false,
          confirmText: '我知道了',
        });
      },
    });
  },

  onEmailLogin() {
    if (!this.ensureAgreementAccepted()) return;
    wx.navigateTo({ url: '/pages/auth/register/index' });
  },

  // 微信授权登录（openid 方案）
  onWechatLogin() {
    if (!this.ensureAgreementAccepted()) return;

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
    if (!this.ensureAgreementAccepted()) return;

    this.setData({ isLoading: true, error: null });

    try {
      const user = await authApi.createGuest();
      const sessionId = user.session_id || user.id;

      wx.setStorageSync('auth_token', sessionId);
      wx.setStorageSync('user_id', user.id);

      store.setUser({
        id: user.id,
        is_guest: true,
        username: user.username || '游客用户'
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
