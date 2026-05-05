// pages/groups/index.js
const { groupsApi, historyApi } = require('../../utils/api');
const store = require('../../utils/store');

Page({
  data: {
    groups: [],
    currentGroupId: 'ungrouped',
    currentTasks: [],
    ungroupedCount: 0,
    isLoading: true,
    error: null,
    showModal: false,
    formData: {
      name: '',
      description: '',
    },
    showMoveModal: false,
    currentTaskId: null,
    showDeleteModal: false,
    deleteGroupName: '',
    deleteGroupId: null,
  },

  onLoad() {
    console.log('[onLoad] 分组页面加载');
    this.loadData();
  },

  onShow() {
    console.log('[onShow] 分组页面显示');
    // 每次显示页面时刷新数据，确保分组数据最新
    if (!this.data.isLoading) {
      console.log('[onShow] 刷新分组数据');
      this.loadData();
    }
  },

  // 加载数据
  async loadData() {
    try {
      console.log('[loadData] 开始加载分组和历史数据');
      this.setData({ isLoading: true, error: null });

      // 分别加载分组和历史记录，避免一个失败导致都失败
      let groups = [];
      let history = [];

      try {
        console.log('[loadData] 调用 groupsApi.getList()');
        groups = await groupsApi.getList();
        console.log('[loadData] 获取分组成功:', groups);
      } catch (err) {
        console.error('[ERROR] 获取分组失败:', err.message || err);
        groups = [];
      }

      try {
        console.log('[loadData] 调用 historyApi.getList()');
        history = await historyApi.getList();
        console.log('[loadData] 获取历史记录成功:', history);
        console.log('[loadData] 历史记录详细信息：');
        history.forEach((h, idx) => {
          console.log(`  [${idx}] id=${h.id}, title=${h.title}, group_id=${h.group_id}, group_ids=${JSON.stringify(h.group_ids)}`);
        });
      } catch (err) {
        console.error('[ERROR] 获取历史记录失败:', err.message || err);
        history = [];
      }

      console.log('[loadData] 最终接收的数据:');
      console.log('  - groups:', groups);
      console.log('  - history:', history);
      console.log('  - groups 类型:', typeof groups, '长度:', Array.isArray(groups) ? groups.length : 'N/A');
      console.log('  - history 类型:', typeof history, '长度:', Array.isArray(history) ? history.length : 'N/A');

      // 确保是数组
      if (!Array.isArray(groups)) {
        console.warn('[WARN] groups 不是数组，重置为空数组');
        groups = [];
      }
      if (!Array.isArray(history)) {
        console.warn('[WARN] history 不是数组，重置为空数组');
        history = [];
      }

      // 格式化历史记录，确保 group_id 字段正确
      history = history.map(h => {
        // 兼容旧格式：如果有 group_ids (数组)，转换为 group_id (单数)
        if (h.group_ids && Array.isArray(h.group_ids) && h.group_ids.length > 0 && !h.group_id) {
          h.group_id = h.group_ids[0];
          console.warn(`[WARN] 转换 group_ids 为 group_id: ${h.id} -> ${h.group_id}`);
        }
        return h;
      });

      // 计算未分组数量
      const ungroupedTasks = history.filter(h => !h.group_id);
      const ungroupedCount = ungroupedTasks.length;

      console.log('[loadData] 未分组任务数:', ungroupedCount);

      // 为每个分组计算视频数量
      const groupsWithCount = groups.map(g => {
        const count = history.filter(h => h.group_id === g.id).length;
        console.log(`[loadData] 分组 "${g.name}"(${g.id}): ${count} 个视频`);
        return {
          ...g,
          video_count: count,
        };
      });

      console.log('[loadData] 处理后的分组列表:', groupsWithCount);
      console.log('[loadData] 分组总数:', groupsWithCount.length);

      store.setGroups(groups);
      this.setData({
        groups: groupsWithCount,
        ungroupedCount,
      });

      console.log('[loadData] setData 完成');
      console.log('[loadData] 当前数据状态:', {
        groups: this.data.groups.length,
        ungroupedCount: this.data.ungroupedCount,
      });

      this.loadTasksForGroup(this.data.currentGroupId, history, groupsWithCount);
      this.setData({ isLoading: false });

      console.log('[loadData] 数据加载完成');
    } catch (error) {
      console.error('[ERROR] 加载数据出现异常:', error);
      console.error('[ERROR] 错误详情:', error.message || error);
      this.setData({
        error: error.message || '加载失败',
        isLoading: false,
      });
    }
  },

  // 根据当前分组加载任务
  loadTasksForGroup(groupId, history, groups) {
    let tasks = [];
    if (groupId === 'ungrouped') {
      tasks = history.filter(h => !h.group_id);
    } else {
      tasks = history.filter(h => h.group_id === groupId);
    }
    this.setData({ currentTasks: tasks });
  },

  // 返回首页
  onBack() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  // 切换分组标签
  onTabChange(e) {
    const groupId = e.currentTarget.dataset.groupId;
    this.setData({ currentGroupId: groupId });

    // 重新加载任务
    historyApi.getList().then(history => {
      this.loadTasksForGroup(groupId, history, this.data.groups);
    });
  },

  // 显示新建分组弹窗
  onShowAddModal() {
    this.setData({
      showModal: true,
      formData: { name: '', description: '' },
    });
  },

  // 关闭弹窗
  onCloseModal() {
    this.setData({ showModal: false });
  },

  // 输入分组名称
  onNameInput(e) {
    this.setData({ 'formData.name': e.detail.value });
  },

  // 输入分组描述
  onDescInput(e) {
    this.setData({ 'formData.description': e.detail.value });
  },

  // 保存分组
  async onSaveGroup() {
    const { formData } = this.data;

    if (!formData.name.trim()) {
      wx.showToast({ title: '请输入分组名称', icon: 'error' });
      return;
    }

    try {
      await groupsApi.create(formData.name, formData.description);
      wx.showToast({ title: '分组已创建', icon: 'success' });
      this.setData({ showModal: false });
      this.loadData();
    } catch (error) {
      wx.showToast({ title: error.message || '创建失败', icon: 'error' });
    }
  },

  // 删除分组
  onDeleteGroup(e) {
    const groupId = e.currentTarget.dataset.groupId;
    const group = this.data.groups.find(g => g.id === groupId);
    if (group) {
      this.setData({
        showDeleteModal: true,
        deleteGroupId: groupId,
        deleteGroupName: group.name || '此分组',
      });
    }
  },

  // 关闭删除确认弹窗
  onCloseDeleteModal() {
    this.setData({ showDeleteModal: false });
  },

  // 确认删除
  async onConfirmDelete() {
    const { deleteGroupId } = this.data;
    try {
      await groupsApi.delete(deleteGroupId);
      wx.showToast({ title: '分组已删除', icon: 'success' });
      this.setData({ showDeleteModal: false, currentGroupId: 'ungrouped' });
      this.loadData();
    } catch (error) {
      wx.showToast({ title: error.message || '删除失败', icon: 'error' });
    }
  },

  // 移动任务到分组 - 显示弹窗
  onMoveToGroup(e) {
    const taskId = e.currentTarget.dataset.taskId;
    this.setData({
      showMoveModal: true,
      currentTaskId: taskId,
    });
  },

  // 关闭移动弹窗
  onCloseMoveModal() {
    this.setData({ showMoveModal: false });
  },

  // 确认移动
  async onConfirmMove(e) {
    const groupId = e.currentTarget.dataset.groupId;
    const { currentTaskId } = this.data;

    try {
      await historyApi.updateGroup(currentTaskId, groupId === 'ungrouped' ? null : groupId);
      wx.showToast({ title: '已移动', icon: 'success' });
      this.setData({ showMoveModal: false });
      this.loadData();
    } catch (error) {
      wx.showToast({ title: error.message || '移动失败', icon: 'error' });
    }
  },
});