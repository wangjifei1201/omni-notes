// pages/index/index.js
const { analysisApi } = require('../../utils/api');
const store = require('../../utils/store');

Page({
  data: {
    videoUrl: '',
    isAnalyzing: false,
    showAuthModal: false,
    isLoggedIn: false,
    focused: false,
  },

  onLoad() {
    this.checkLoginStatus();
  },

  onShow() {
    this.checkLoginStatus();
  },

  checkLoginStatus() {
    const userId = wx.getStorageSync('user_id');
    const isLoggedIn = !!userId;
    const state = store.getState();
    this.setData({
      isLoggedIn,
      showAuthModal: !isLoggedIn,
    });
  },

  onUrlInput(e) {
    const videoUrl = e.detail.value;
    this.setData({ videoUrl });
  },

  onFocus: function() {
    this.setData({ focused: true });
  },

  onBlur: function() {
    this.setData({ focused: false });
  },

  onSubmitAnalysis() {
    const { videoUrl, isLoggedIn, isAnalyzing } = this.data;
    if (isAnalyzing) return;

    if (!isLoggedIn) {
      this.setData({ showAuthModal: true });
      return;
    }
    if (!videoUrl) {
      wx.showToast({ title: '请输入视频链接', icon: 'error' });
      return;
    }

    this.setData({ isAnalyzing: true });
    wx.showLoading({ title: '提交中...' });

    analysisApi.create(videoUrl, 'comprehensive')
      .then(res => {
        const taskId = res.task_id || res.id;
        if (!taskId) throw new Error('未获取到任务ID');
        const task = { taskId, url: videoUrl, title: res.title || '视频分析', status: res.status || 'queued' };
        store.addTask(task);
        this.setData({ videoUrl: '' });
        wx.hideLoading();
        wx.showToast({ title: '已提交', icon: 'success' });
        setTimeout(() => wx.navigateTo({ url: `/pages/analysis/detail/index?taskId=${taskId}` }), 500);
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({ title: err.message || '失败', icon: 'error' });
      })
      .finally(() => this.setData({ isAnalyzing: false }));
  },

  onGuestLogin() {
    this.setData({ showAuthModal: false, isLoggedIn: true });
  },

  onCloseAuthModal() {
    this.setData({ showAuthModal: false });
  },
});