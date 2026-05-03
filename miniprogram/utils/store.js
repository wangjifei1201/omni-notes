/**
 * 全局状态管理
 */

class Store {
  constructor() {
    this.state = {
      // 认证状态
      user: null,
      isLoggedIn: false,
      isGuest: false,
      token: '',

      // 分析状态
      currentTask: null,
      activeTasks: [],
      analysisHistory: [],

      // 分组
      groups: [],

      // UI状态
      loading: false,
      error: null,
    };

    this.listeners = [];
    this.loadState();
  }

  // 订阅状态变化
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  // 通知所有监听者
  notify() {
    this.listeners.forEach(callback => callback(this.state));
  }

  // 更新状态
  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.saveState();
    this.notify();
  }

  // 保存状态到本地存储
  saveState() {
    try {
      wx.setStorageSync('app_state', JSON.stringify(this.state));
    } catch (e) {
      console.error('保存状态失败:', e);
    }
  }

  // 从本地存储加载状态
  loadState() {
    try {
      const saved = wx.getStorageSync('app_state');
      if (saved) {
        this.state = { ...this.state, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('加载状态失败:', e);
    }
  }

  // ============ 认证相关 ============
  setUser(user) {
    this.setState({
      user,
      isLoggedIn: !!user,
      token: user?.token || '',
    });
    if (user?.token) {
      wx.setStorageSync('auth_token', user.token);
      wx.setStorageSync('user_id', user.id);
    }
  }

  setGuest(user) {
    this.setState({
      user,
      isGuest: true,
      isLoggedIn: true,
      token: user?.token || '',
    });
    if (user?.token) {
      wx.setStorageSync('auth_token', user.token);
      wx.setStorageSync('user_id', user.id);
    }
  }

  logout() {
    this.setState({
      user: null,
      isLoggedIn: false,
      isGuest: false,
      token: '',
      currentTask: null,
      activeTasks: [],
    });
    wx.removeStorageSync('auth_token');
    wx.removeStorageSync('user_id');
  }

  // ============ 分析任务相关 ============
  setCurrentTask(task) {
    this.setState({ currentTask: task });
  }

  addTask(task) {
    const activeTasks = [...this.state.activeTasks, task];
    this.setState({ activeTasks, currentTask: task });
  }

  updateTask(taskId, updates) {
    const activeTasks = this.state.activeTasks.map(task =>
      task.taskId === taskId ? { ...task, ...updates } : task
    );
    const currentTask = this.state.currentTask?.taskId === taskId
      ? { ...this.state.currentTask, ...updates }
      : this.state.currentTask;
    this.setState({ activeTasks, currentTask });
  }

  removeTask(taskId) {
    const activeTasks = this.state.activeTasks.filter(task => task.taskId !== taskId);
    const currentTask = this.state.currentTask?.taskId === taskId ? null : this.state.currentTask;
    this.setState({ activeTasks, currentTask });
  }

  // ============ 历史记录相关 ============
  setAnalysisHistory(history) {
    this.setState({ analysisHistory: history });
  }

  addToHistory(item) {
    const analysisHistory = [item, ...this.state.analysisHistory];
    this.setState({ analysisHistory });
  }

  // ============ 分组相关 ============
  setGroups(groups) {
    this.setState({ groups });
  }

  // ============ UI状态 ============
  setLoading(loading) {
    this.setState({ loading });
  }

  setError(error) {
    this.setState({ error });
  }

  clearError() {
    this.setState({ error: null });
  }

  // ============ 获取状态 ============
  getState() {
    return this.state;
  }

  getUser() {
    return this.state.user;
  }

  isAuthenticated() {
    return this.state.isLoggedIn;
  }

  getCurrentTask() {
    return this.state.currentTask;
  }

  getActiveTasks() {
    return this.state.activeTasks;
  }

  getAnalysisHistory() {
    return this.state.analysisHistory;
  }

  getGroups() {
    return this.state.groups;
  }
}

// 创建全局单例
const store = new Store();

module.exports = store;
