// pages/auth/register/index.js
const { authApi } = require('../../../utils/api');
const store = require('../../../utils/store');

Page({
  data: {
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    isLoading: false,
    error: null,
    showPassword: false,
    showConfirmPassword: false,
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value });
  },

  onEmailInput(e) {
    this.setData({ email: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  onConfirmPasswordInput(e) {
    this.setData({ confirmPassword: e.detail.value });
  },

  onTogglePassword() {
    this.setData({ showPassword: !this.data.showPassword });
  },

  onToggleConfirmPassword() {
    this.setData({ showConfirmPassword: !this.data.showConfirmPassword });
  },

  async onRegister() {
    const { username, email, password, confirmPassword } = this.data;

    if (!username.trim()) {
      this.setData({ error: '请输入用户名' });
      return;
    }

    if (!email.trim()) {
      this.setData({ error: '请输入邮箱' });
      return;
    }

    if (!password.trim()) {
      this.setData({ error: '请输入密码' });
      return;
    }

    if (password !== confirmPassword) {
      this.setData({ error: '两次输入的密码不一致' });
      return;
    }

    if (password.length < 6) {
      this.setData({ error: '密码长度至少6位' });
      return;
    }

    this.setData({ isLoading: true, error: null });
    wx.showLoading({ title: '注册中...' });

    try {
      const user = await authApi.register(email, password, username);
      store.setUser(user);
      wx.hideLoading();
      wx.showToast({
        title: '注册成功',
        icon: 'success',
      });
      setTimeout(() => {
        wx.navigateBack({ delta: 1 });
      }, 500);
    } catch (error) {
      wx.hideLoading();
      this.setData({
        error: error.message || '注册失败',
        isLoading: false,
      });
    }
  },

  onNavigateToLogin() {
    wx.navigateTo({
      url: '/pages/auth/login/index',
    });
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },
});
