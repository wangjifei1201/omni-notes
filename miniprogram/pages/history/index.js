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
    selectedGroupId: 'all',  // 当前选中的分组ID
    totalCount: 0,
    ungroupedCount: 0,
    sortBy: 'recent',
    sortByIndex: 0,
    searchText: '',
    searchKeyword: '',     // wxml 搜索关键词
    showActionSheet: false, // 操作菜单
    currentItem: {},       // 当前操作项
    showGroupPicker: false, // 分组选择面板
    showGroupManager: false, // 分组管理面板
    showAddGroupModal: false, // 新建分组弹窗
    editingGroupId: null,  // 编辑中的分组ID
    groupFormData: {        // 分组表单数据
      name: '',
      description: '',
    },
    sortOptions: [
      { label: '最新', value: 'recent' },
    ],
    startX: 0,
    delBtnWidth: 80,
  },

  onLoad() {
    this.loadHistory();
  },

  onShow() {
    // 每次显示时刷新历史记录和分组
    this.loadHistory();
    this.loadGroups();
  },

  // 加载历史记录
  async loadHistory() {
    try {
      this.setData({ isLoading: true, error: null });

      const params = {
        sort_by: this.data.sortBy,
      };

      if (this.data.searchText) {
        params.search = this.data.searchText;
      }

      const response = await historyApi.getList(params);

      // 处理历史记录
      let history = (response.items || []).map((item, index) => {
        const processedKeyPoints = (item.key_points || []).map(kp => ({
          ...kp,
          point: (kp.point || '').substring(0, 50)
        }));

        return {
          ...item,
          x: 0,
          status: item.status || 'completed',
          title: item.title || item.video_title || '视频分析',
          video_url: item.video_url || item.original_url || '',
          summary: item.summary || '',
          key_points: processedKeyPoints,
          analysis_type: item.analysis_type || '综合分析',
        };
      });

      // 计算分组统计数据
      const totalCount = history.length;
      const ungroupedCount = history.filter(h => !h.group_id).length;

      // 为每个分组计算视频数量
      const groupsWithCount = this.data.groups.map(g => ({
        ...g,
        video_count: history.filter(h => h.group_id === g.id).length,
      }));

      // 根据选中分组筛选
      let filteredHistory = history;
      if (this.data.selectedGroupId === 'ungrouped') {
        filteredHistory = history.filter(h => !h.group_id);
      } else if (this.data.selectedGroupId && this.data.selectedGroupId !== 'all') {
        filteredHistory = history.filter(h => h.group_id === this.data.selectedGroupId);
      }

      // 应用搜索过滤
      if (this.data.searchKeyword) {
        const kw = this.data.searchKeyword.toLowerCase();
        filteredHistory = filteredHistory.filter(item =>
          (item.title && item.title.toLowerCase().includes(kw)) ||
          (item.video_url && item.video_url.toLowerCase().includes(kw))
        );
      }

      this.setData({
        history,
        filteredHistory,
        groups: groupsWithCount,
        totalCount,
        ungroupedCount,
        isLoading: false,
      });

      store.setAnalysisHistory(history);
    } catch (error) {
      console.error('加载历史记录失败:', error);
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

  // 切换分组
  onGroupChange(e) {
    const groupId = e.currentTarget.dataset.groupId;
    this.setData({
      selectedGroupId: groupId,
      searchKeyword: '', // 清空搜索
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

  // 搜索输入
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  // 清除搜索
  onClearSearch() {
    this.setData({ searchKeyword: '' });
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
    const id = e.currentTarget.dataset.id || e.currentTarget.dataset.historyId;
    const item = this.data.history.find(h => h.id === id);
    if (item) {
      this.setData({
        showActionSheet: true,
        currentItem: item,
      });
    }
  },

  // 显示操作菜单
  onShowActions(e) {
    const { id } = e.currentTarget.dataset;
    const item = this.data.history.find(h => h.id === id);
    if (item) {
      this.setData({
        showActionSheet: true,
        currentItem: item,
      });
    }
  },

  // 关闭操作菜单
  onCloseActionSheet() {
    this.setData({ showActionSheet: false });
  },

  // 打开分组管理面板
  onOpenGroupManager() {
    this.setData({ showGroupManager: true });
  },

  // 关闭分组管理面板
  onCloseGroupManager() {
    this.setData({ showGroupManager: false });
  },

  // 显示新建分组弹窗
  onShowAddGroupModal() {
    this.setData({
      showAddGroupModal: true,
      editingGroupId: null,
      groupFormData: { name: '', description: '' },
    });
  },

  // 关闭新建分组弹窗
  onCloseAddGroupModal() {
    this.setData({
      showAddGroupModal: false,
      editingGroupId: null,
      groupFormData: { name: '', description: '' },
    });
  },

  // 编辑分组
  onEditGroup(e) {
    const groupId = e.currentTarget.dataset.groupId;
    const group = this.data.groups.find(g => g.id === groupId);
    if (group) {
      this.setData({
        showAddGroupModal: true,
        editingGroupId: groupId,
        groupFormData: {
          name: group.name || '',
          description: group.description || '',
        },
      });
    }
  },

  // 输入分组名称
  onGroupNameInput(e) {
    this.setData({ 'groupFormData.name': e.detail.value });
  },

  // 输入分组描述
  onGroupDescInput(e) {
    this.setData({ 'groupFormData.description': e.detail.value });
  },

  // 保存分组
  async onSaveGroup() {
    const { groupFormData, editingGroupId } = this.data;

    if (!groupFormData.name.trim()) {
      wx.showToast({ title: '请输入分组名称', icon: 'error' });
      return;
    }

    try {
      if (editingGroupId) {
        // 编辑模式 - 更新分组
        const { groupsApi } = require('../../utils/api');
        await groupsApi.update(editingGroupId, groupFormData.name, groupFormData.description);
        wx.showToast({ title: '分组已更新', icon: 'success' });
      } else {
        // 新建模式
        const { groupsApi } = require('../../utils/api');
        await groupsApi.create(groupFormData.name, groupFormData.description);
        wx.showToast({ title: '分组已创建', icon: 'success' });
      }
      this.setData({
        showAddGroupModal: false,
        editingGroupId: null,
        groupFormData: { name: '', description: '' },
      });
      this.loadGroups();
      this.loadHistory();
    } catch (error) {
      wx.showToast({ title: error.message || '操作失败', icon: 'error' });
    }
  },

  // 删除分组确认
  onDeleteGroupConfirm(e) {
    const groupId = e.currentTarget.dataset.groupId;
    const group = this.data.groups.find(g => g.id === groupId);
    if (group) {
      wx.showModal({
        title: '删除分组',
        content: `确定要删除分组"${group.name}"吗？分组下的任务将移至未分组。`,
        success: async (res) => {
          if (res.confirm) {
            try {
              const { groupsApi } = require('../../utils/api');
              await groupsApi.delete(groupId);
              wx.showToast({ title: '分组已删除', icon: 'success' });
              this.loadGroups();
              this.loadHistory();
            } catch (error) {
              wx.showToast({ title: error.message || '删除失败', icon: 'error' });
            }
          }
        },
      });
    }
  },

  // 移动到分组 - 显示分组选择面板
  onMoveToGroup(e) {
    // 如果是从卡片按钮点击，itemId 会通过 dataset 传递
    const itemId = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id;
    if (itemId) {
      const item = this.data.history.find(h => h.id === itemId);
      if (item) {
        this.setData({ currentItem: item });
      }
    }
    this.setData({
      showActionSheet: false,
      showGroupPicker: true,
    });
  },

  // 关闭分组选择面板
  onCloseGroupPicker() {
    this.setData({ showGroupPicker: false });
  },

  // 确认移动到分组
  async onConfirmMoveToGroup(e) {
    const groupId = e.currentTarget.dataset.groupId;
    const { currentItem } = this.data;

    // 如果是新建分组选项
    if (groupId === 'ungrouped') {
      // 关闭分组选择面板，显示新建分组弹窗
      this.setData({ showGroupPicker: false });
      this.onShowAddGroupModal();
      return;
    }

    try {
      const { historyApi } = require('../../utils/api');
      await historyApi.updateGroup(currentItem.id, groupId);
      wx.showToast({ title: '已移动', icon: 'success' });
      this.setData({ showGroupPicker: false });
      this.loadHistory();
      this.loadGroups();
    } catch (error) {
      wx.showToast({ title: error.message || '移动失败', icon: 'error' });
    }
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

  // 去分析页面
  onGoAnalyze() {
    wx.switchTab({ url: '/pages/index/index' });
  },
});