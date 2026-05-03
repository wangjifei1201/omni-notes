// pages/profile/index.js
const store = require('../../utils/store');

Page({
  data: {
    appVersion: '2.0.0',
    userInfo: {
      nickName: '游客用户',
      isVIP: false,
    },
    userStats: {
      analysisCount: 0,
      favoriteCount: 0,
      daysJoined: 0,
    },
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    this.loadUserInfo();
  },

  // 加载用户信息
  loadUserInfo() {
    const user = store.getUser();
    if (user) {
      this.setData({
        userInfo: {
          nickName: user.username || user.nickname || '用户',
          isVIP: user.is_vip || false,
        },
      });
    }

    // 从历史记录统计
    const state = store.getState();
    const history = state.analysisHistory || [];
    const analysisCount = history.length;
    const favoriteCount = history.filter(h => h.is_favorite).length;

    // 计算使用天数
    let daysJoined = 0;
    if (user && user.created_at) {
      const created = new Date(user.created_at);
      const now = new Date();
      daysJoined = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    }

    this.setData({
      userStats: {
        analysisCount,
        favoriteCount,
        daysJoined,
      },
    });
  },

  // 使用帮助
  onGoHelp() {
    wx.showModal({
      title: '使用帮助',
      content: `欢迎使用 Omni-Notes！

【支持平台】
• 哔哩哔哩 (B站)
• 抖音

【使用方法】
1. 复制视频链接
2. 粘贴到分析输入框
3. 点击"开始分析"
4. 等待AI完成分析
5. 查看分析结果

【支持的视频类型】
• 教程类视频
• 知识讲解视频
• 评测视频
• 演讲/课程
• 任何公开发布的视频

【分析内容】
• 视频内容摘要
• 关键要点提取
• 章节划分
• 思维导图生成

【常见问题】
Q: 分析失败怎么办？
A: 请确保视频链接正确且视频可公开访问。

Q: 分析需要多长时间？
A: 根据视频长度，一般 1-5 分钟完成。

Q: 如何保存分析结果？
A: 分析结果会保存在"历史"中，可随时查看。

如需更多帮助，请联系我们的客服。`,
      showCancel: false,
      confirmText: '知道了',
    });
  },

  // 关于页面
  onGoAbout() {
    wx.showModal({
      title: '关于 Omni-Notes',
      content: `Omni-Notes v2.0.0

AI 视频笔记助手

基于先进的大语言模型技术，
为用户提供智能视频分析服务。

【主要功能】
• 视频链接分析
• AI 智能摘要
• 关键要点提取
• 章节自动划分
• 思维导图生成

【技术说明】
• 分析引擎：大语言模型
• 语音识别：Whisper
• 支持平台：B站、抖音

© 2024 Omni-Notes`,
      showCancel: false,
      confirmText: '知道了',
    });
  },
});