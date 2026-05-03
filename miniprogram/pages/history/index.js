// pages/history/index.js
const { historyApi, groupsApi } = require('../../utils/api');
const store = require('../../utils/store');

Page({
  data: {
    history: [],
    filteredHistory: [],  // wxml 模板使用的筛选后列表
    groups: [],
    isLoading: true,
    error: null,
    selectedGroup: null,
    sortBy: 'recent',
    sortByIndex: 0,
    searchText: '',
    searchKeyword: '',     // wxml 搜索关键词
    showFilter: false,     // 筛选面板显示
    currentFilter: 'all',  // 当前筛选条件
    showActionSheet: false, // 操作菜单
    currentItem: {},       // 当前操作项
    selectedItems: [],     // 多选项
    stats: {               // 统计数据
      total: 0,
      today: 0,
      favorites: 0,
    },
    sortOptions: [
      { label: '最新', value: 'recent' },
      { label: '收藏', value: 'favorite' },
    ],
    startX: 0,
    delBtnWidth: 80,
  },

  onLoad() {
    this.loadHistory();
    this.loadGroups();
  },

  onShow() {
    // 每次显示时刷新历史记录
    this.loadHistory();
  },

  // 加载历史记录
  async loadHistory() {
    try {
      console.log('[loadHistory] 开始加载历史记录');
      this.setData({ isLoading: true, error: null });

      const params = {
        group_id: this.data.selectedGroup,
        sort_by: this.data.sortBy,
      };

      if (this.data.searchText) {
        params.search = this.data.searchText;
      }

      console.log('[loadHistory] 请求参数:', params);

      const response = await historyApi.getList(params);

      console.log('[loadHistory] API 响应完整数据:', response);
      console.log('[loadHistory] 响应类型:', typeof response);
      console.log('[loadHistory] 响应属性:', Object.keys(response || {}));
      console.log('[loadHistory] response.items:', response.items);
      console.log('[loadHistory] response.items 类型:', typeof response.items);
      console.log('[loadHistory] response.items 是数组?', Array.isArray(response.items));
      console.log('[loadHistory] response.items 长度:', Array.isArray(response.items) ? response.items.length : 'N/A');

      // 处理历史记录，确保状态正确
      const history = (response.items || []).map((item, index) => {
        console.log(`[loadHistory] 处理第 ${index} 条记录:`, {
          id: item.id,
          title: item.title,
          status: item.status,
          platform: item.platform,
        });
        return {
          ...item,
          x: 0, // 初始化X坐标为0（未滑动）
          // 确保状态字段存在
          status: item.status || 'completed',
          title: item.title || item.video_title || '视频分析',
          video_url: item.video_url || item.original_url || '',
          analysis_type: item.analysis_type || '综合分析',
        };
      });

      console.log('[loadHistory] 处理后的历史记录数:', history.length);
      console.log('[loadHistory] 处理后的历史记录:', history);

      this.setData({
        history,
        filteredHistory: history,
        isLoading: false,
      });

      console.log('[loadHistory] setData 完成');
      console.log('[loadHistory] 当前数据状态:', {
        historyLength: this.data.history.length,
        filteredHistoryLength: this.data.filteredHistory.length,
      });

      // 计算统计数据
      this.updateStats(history);

      // 更新 store
      store.setAnalysisHistory(history);

      console.log('[loadHistory] 历史记录加载完成');

    } catch (error) {
      console.error('[ERROR] 加载历史记录失败:', error);
      console.error('[ERROR] 错误详情:', error.message || error);
      this.setData({
        error: error.message || '加载失败',
        isLoading: false,
      });
    }
  },

  // 加载分组
  async loadGroups() {
    try {
      const groups = await groupsApi.getList();
      store.setGroups(groups);
      this.setData({ groups });
    } catch (error) {
      console.error('加载分组失败:', error);
    }
  },

  // 搜索
  onSearch(e) {
    this.setData({ searchText: e.detail.value });
  },

  // 执行搜索
  onSearchSubmit() {
    this.loadHistory();
  },

  // 选择分组
  onSelectGroup(e) {
    const { groupId } = e.currentTarget.dataset;
    this.setData({
      selectedGroup: this.data.selectedGroup === groupId ? null : groupId,
    });
    this.loadHistory();
  },

  // 改变排序
  onChangeSortBy(e) {
    const index = e.detail.value;
    this.setData({
      sortByIndex: index,
      sortBy: this.data.sortOptions[index].value,
    });
    this.loadHistory();
  },

  // 点击历史记录项
  onHistoryItemClick(e) {
    const { historyId } = e.currentTarget.dataset;
    console.log('点击历史记录:', historyId);
    
    // 查找对应的历史记录
    const item = this.data.history.find(h => h.id === historyId);
    
    if (!item) {
      wx.showToast({
        title: '记录不存在',
        icon: 'error',
      });
      return;
    }
    
    // 根据状态跳转
    if (item.status === 'completed') {
      // 已完成，跳转到详情页查看结果
      wx.navigateTo({
        url: `/pages/analysis/detail/index?taskId=${historyId}`,
      });
    } else if (item.status === 'failed') {
      // 失败，显示错误信息
      wx.showModal({
        title: '分析失败',
        content: item.error_message || '分析过程中出现错误',
        showCancel: false,
      });
    } else {
      // 处理中，跳转到详情页查看进度
      wx.navigateTo({
        url: `/pages/analysis/detail/index?taskId=${historyId}`,
      });
    }
  },

  // 切换收藏
  async onToggleFavorite(e) {
    e.stopPropagation(); // 阻止事件冒泡
    const { historyId, isFavorite } = e.currentTarget.dataset;
    
    try {
      await historyApi.toggleFavorite(historyId, !isFavorite);
      
      // 更新本地状态
      const history = this.data.history.map(item => {
        if (item.id === historyId) {
          return { ...item, is_favorite: !isFavorite };
        }
        return item;
      });
      
      this.setData({ history });
      
      wx.showToast({
        title: isFavorite ? '已取消收藏' : '已收藏',
        icon: 'success',
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '操作失败',
        icon: 'error',
      });
    }
  },

  // 左滑开始
  onItemMove(e) {
    const { index } = e.currentTarget.dataset;
    const { x } = e.detail;
    
    // 更新对应项的X坐标
    const history = this.data.history;
    history[index].x = x;
    this.setData({ history });
  },

  // 左滑结束
  onItemTouchEnd(e) {
    const { index, historyId } = e.currentTarget.dataset;
    const { x } = e.detail;
    
    // 如果滑动超过一半，显示删除按钮
    const delBtnWidth = this.data.delBtnWidth;
    const newX = x > -delBtnWidth / 2 ? 0 : -delBtnWidth;
    
    // 更新对应项的X坐标
    const history = this.data.history;
    history[index].x = newX;
    this.setData({ history });
  },

  // 删除历史记录
  async onDeleteHistory(e) {
    const { historyId } = e.currentTarget.dataset;
    
    wx.showModal({
      title: '删除记录',
      content: '确定要删除此记录吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await historyApi.delete(historyId);
            
            // 从列表中移除
            const history = this.data.history.filter(item => item.id !== historyId);
            this.setData({ history });
            
            wx.showToast({
              title: '已删除',
              icon: 'success',
            });
          } catch (error) {
            wx.showToast({
              title: error.message || '删除失败',
              icon: 'error',
            });
          }
        }
      },
    });
  },

  // 关闭所有滑动的项
  closeAllSwipe() {
    const history = this.data.history.map(item => ({ ...item, x: 0 }));
    this.setData({ history });
  },

  // 返回上一页
  onGoBack() {
    wx.navigateBack();
  },

  // 切换筛选面板显示
  onToggleFilter() {
    this.setData({ showFilter: !this.data.showFilter });
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
    this.applyFilter();
  },

  // 清除搜索
  onClearSearch() {
    this.setData({ searchKeyword: '' });
    this.applyFilter();
  },

  // 筛选标签切换
  onFilterChange(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ currentFilter: filter });
    this.applyFilter();
  },

  // 项目点击（兼容新旧模板）
  onItemClick(e) {
    const id = e.currentTarget.dataset.id || e.currentTarget.dataset.historyId;
    if (id) {
      this.onHistoryItemClick({ currentTarget: { dataset: { historyId: id } } });
    }
  },

  // 长按（兼容新旧模板）
  onItemLongPress(e) {
    // 可以显示更多操作菜单
  },

  // 显示操作菜单
  onShowActions(e) {
    const { id } = e.currentTarget.dataset;
    const item = this.data.history.find(h => h.id === id);
    if (item) {
      this.setData({ 
        showActionSheet: true, 
        currentItem: item 
      });
    }
  },

  // 关闭操作菜单
  onCloseActionSheet() {
    this.setData({ showActionSheet: false });
  },

  // 去分析页面
  onGoAnalyze() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  // 计算统计数据
  updateStats(history) {
    const total = history.length;
    const today = history.filter(item => {
      if (!item.created_at) return false;
      const d = new Date(item.created_at);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;
    const favorites = history.filter(item => item.is_favorite).length;
    this.setData({
      stats: { total, today, favorites },
    });
  },

  // 应用筛选
  applyFilter() {
    const { history, currentFilter, searchKeyword } = this.data;
    let filtered = [...history];

    // 关键词过滤
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      filtered = filtered.filter(item =>
        (item.title && item.title.toLowerCase().includes(kw)) ||
        (item.video_url && item.video_url.toLowerCase().includes(kw))
      );
    }

    // 时间/收藏过滤
    const now = new Date();
    if (currentFilter === 'today') {
      filtered = filtered.filter(item => {
        if (!item.created_at) return false;
        return new Date(item.created_at).toDateString() === now.toDateString();
      });
    } else if (currentFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(item => {
        if (!item.created_at) return false;
        return new Date(item.created_at) >= weekAgo;
      });
    } else if (currentFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(item => {
        if (!item.created_at) return false;
        return new Date(item.created_at) >= monthAgo;
      });
    } else if (currentFilter === 'favorite') {
      filtered = filtered.filter(item => item.is_favorite);
    }

    this.setData({ filteredHistory: filtered });
  },

  // 查看详情
  onViewDetail() {
    const { currentItem } = this.data;
    this.setData({ showActionSheet: false });
    if (currentItem && currentItem.id) {
      wx.navigateTo({
        url: `/pages/analysis/detail/index?taskId=${currentItem.id}`,
      });
    }
  },

  // 分享
  onShare() {
    this.setData({ showActionSheet: false });
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline'],
    });
  },

  // 切换收藏（操作菜单）
  onToggleFavoriteItem() {
    const { currentItem } = this.data;
    this.setData({ showActionSheet: false });
    if (currentItem) {
      this.onToggleFavorite({
        stopPropagation: () => {},
        currentTarget: {
          dataset: {
            historyId: currentItem.id,
            isFavorite: currentItem.is_favorite,
          },
        },
      });
    }
  },

  // 删除单项（操作菜单）
  onDeleteItem() {
    const { currentItem } = this.data;
    this.setData({ showActionSheet: false });
    if (currentItem) {
      this.onDeleteHistory({
        currentTarget: { dataset: { historyId: currentItem.id } },
      });
    }
  },

  // 批量收藏
  onBatchFavorite() {
    wx.showToast({ title: '批量收藏功能开发中', icon: 'none' });
  },

  // 批量删除
  onBatchDelete() {
    wx.showToast({ title: '批量删除功能开发中', icon: 'none' });
  },
});