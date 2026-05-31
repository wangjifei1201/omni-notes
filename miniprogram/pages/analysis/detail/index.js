// pages/analysis/detail/index.js
const { analysisApi, historyApi, groupsApi } = require('../../../utils/api');
const store = require('../../../utils/store');

Page({
  data: {
    taskId: '',
    task: null,
    result: null,
    isLoading: true,
    error: null,

    // ===== 左滑操作相关 =====
    swipeClass: '',
    touchStartX: 0,
    touchStartY: 0,

    // ===== wxml 模板所需的 analysis 对象 =====
    analysis: {
      video: {
        thumbnail: '',
        platform: '',
        title: '未命名视频',
        author: '',
        url: '',
      },
      created_at: '',
      summary: '',
      keypoints: [],
      mindmap: '',
      mindmapTree: null,
      transcript: null,
      group_id: null,
      group_name: '',
    },

    // 标签页状态（默认显示摘要）
    activeTab: 'summary',

    // 步骤状态
    currentStep: 'extract',
    elapsedTime: 0,
    overallProgress: 0,

    // 步骤完成状态（用于UI）
    stepStatus: {
      extract: 'pending',
      download: 'pending',
      transcribe: 'pending',
      analyze: 'pending',
    },

    // 格式化的时间（用于显示）
    elapsedTimeFormat: '00:00',
    currentStepName: '准备开始...',

    // 子进度
    downloadProgress: null,
    transcribeProgress: null,

    // 详细进度信息
    currentMessage: '准备开始...',

    // 结果数据（保留扁平结构用于复制等操作）
    summary: '',
    keypoints: [],
    chapters: [],
    mindmap: '',
    fullAnalysis: '',

    // 分组相关数据
    groups: [],
    showGroupSheet: false,
    showCreateGroupModal: false,
    createGroupForm: {
      name: '',
      description: '',
    },
  },

  // 使用实例变量存储定时器，避免状态管理问题
  progressInterval: null,
  timerInterval: null,
  currentTaskId: null,
  _taskStartTime: null,  // 任务开始时间戳，用于计算总耗时

  onLoad(options) {
    const { taskId } = options;

    if (!taskId) {
      this.setData({
        error: '缺少任务ID',
        isLoading: false,
      });
      return;
    }

    // 清理旧的定时器（非常重要！）
    this.cleanupInterval();

    // 设置当前任务ID（实例变量，不受 setData 影响）
    this.currentTaskId = taskId;
    this._taskStartTime = null;

    // 更新页面数据
    this.setData({
      taskId,
      isLoading: true,
      error: null,
      overallProgress: 0,
      currentStep: 'extract',
      currentMessage: '准备开始...',
      activeTab: 'summary',
      stepStatus: { extract: 'pending', download: 'pending', transcribe: 'pending', analyze: 'pending' },
      elapsedTime: 0,
      elapsedTimeFormat: '00:00',
      currentStepName: '准备开始...',
      downloadProgress: null,
      transcribeProgress: null,
      // 左滑状态重置
      swipeClass: '',
      touchStartX: 0,
      touchStartY: 0,
      // 初始化 task 对象用于 wxml 判断状态
      task: { taskId, status: 'pending', status_text: '准备中...' },
    });

    // 加载分组列表
    this.loadGroups();

    // 加载任务详情并启动进度跟踪
    this.loadTaskDetails();
  },

  onShow() {
    // 如果任务在运行中但没有轮询，重新启动轮询
    // 如果任务在运行中但没有轮询，重新启动轮询
    if (this.currentTaskId && this.data.task && (this.data.task.status === 'running' || this.data.task.status === 'queued' || this.data.task.status === 'processing')) {
      if (!this.progressInterval) {
        this.startProgressTracking();
      }
    }
  },

  onUnload() {
    this.cleanupInterval();
  },

  onHide() {
    // 页面隐藏时也可以暂停轮询，节省资源
    this.cleanupInterval();
  },

  // 清理定时器（核心修复）
  cleanupInterval() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  // ===== 左滑操作相关方法 =====
  onTouchStart(e) {
    // 只在分析完成的卡片上响应滑动
    if (!this.data.task || this.data.task.status !== 'completed') return;

    const touch = e.touches[0];
    this.setData({
      touchStartX: touch.clientX,
      touchStartY: touch.clientY,
      swipeClass: 'swiping'
    });
  },

  onTouchMove(e) {
    // 只在分析完成的卡片上响应滑动
    if (!this.data.task || this.data.task.status !== 'completed') return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - this.data.touchStartX;
    const deltaY = Math.abs(touch.clientY - this.data.touchStartY);

    // 横向滑动超过50px且纵向滑动小于20px时触发左滑
    if (deltaX < -50 && deltaY < 20) {
      this.setData({ swipeClass: 'swiped' });
    } else if (deltaX > -50) {
      this.setData({ swipeClass: '' });
    }
  },

  onTouchEnd(e) {
    // 只在分析完成的卡片上响应滑动
    if (!this.data.task || this.data.task.status !== 'completed') return;

    const deltaX = e.changedTouches[0].clientX - this.data.touchStartX;
    const deltaY = Math.abs(e.changedTouches[0].clientY - this.data.touchStartY);

    // 横向滑动超过50px且纵向滑动小于20px时保持左滑状态
    if (deltaX < -50 && deltaY < 20) {
      this.setData({ swipeClass: 'swiped' });
    } else {
      this.setData({ swipeClass: '' });
    }
  },

  // ===== 构建 analysis 对象（wxml 模板数据源） =====
  buildAnalysisObject(result, keypoints, mindmap) {
    const analysisResult = result.result || {};

    // 解析视频信息（兼容多种 API 返回格式）
    const videoInfo = result.video || result.video_info || analysisResult.video || {};
    const videoUrl = result.url || result.video_url || videoInfo.url || '';

    // 从 URL 推断平台
    let platform = videoInfo.platform || result.platform || '';
    if (!platform && videoUrl) {
      if (videoUrl.includes('bilibili') || videoUrl.includes('b23.tv')) {
        platform = 'bilibili';
      } else if (videoUrl.includes('douyin') || videoUrl.includes('tiktok')) {
        platform = 'douyin';
      }
    }

    // 格式化创建时间
    let createdAt = result.created_at || result.createdAt || '';
    if (createdAt) {
      try {
        const date = new Date(createdAt);
        createdAt = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      } catch (e) {
        // 保持原始字符串
      }
    }

    // 处理字幕/转录数据
    let transcript = null;
    const transcriptData = analysisResult.transcript || analysisResult.transcription || result.transcript;
    if (transcriptData) {
      if (typeof transcriptData === 'string') {
        // 纯文本字幕，构造为段落格式
        transcript = {
          segments: [{ start: 0, start_time: '00:00', text: transcriptData }],
        };
      } else if (transcriptData.segments && Array.isArray(transcriptData.segments)) {
        transcript = transcriptData;
      } else if (Array.isArray(transcriptData)) {
        transcript = {
          segments: transcriptData.map(item => ({
            start: item.start || item.time || 0,
            start_time: item.start_time || item.timestamp || this.formatTime(item.start || item.time || 0),
            text: item.text || item.content || '',
          })),
        };
      }
    }

    return {
      video: {
        thumbnail: videoInfo.thumbnail || videoInfo.cover || videoInfo.pic || result.thumbnail || '',
        platform: platform,
        title: videoInfo.title || result.title || result.video_title || '未命名视频',
        author: videoInfo.author || videoInfo.uploader || result.author || '',
        url: videoUrl,
      },
      created_at: createdAt,
      summary: analysisResult.summary || '',
      keypoints: keypoints.map(item => ({
        title: item.title || '',
        description: item.content || item.description || '',
        timestamp: item.timestamp || '',
      })),
      mindmap: mindmap,
      mindmapTree: this.normalizeMindmap(mindmap),
      transcript: transcript,
      group_id: result.group_id || null,
      group_name: result.group_name || '',
    };
  },

  // 格式化时间（秒 -> mm:ss）
  formatTime(seconds) {
    if (!seconds && seconds !== 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  },

  // 加载任务详情
  async loadTaskDetails() {
    try {
      this.setData({ isLoading: true, error: null });

      const result = await analysisApi.getById(this.currentTaskId);

      // 获取任务状态（兼容多种字段名）
      const taskStatus = result.status || result.state || 'pending';

      // 提取分析结果数据（注意：result.result 才是分析结果）
      const analysisResult = result.result || {};

      // 处理核心要点 - 保留完整对象（标题 + 内容）
      let keypoints = [];
      if (analysisResult.key_points && Array.isArray(analysisResult.key_points)) {
        keypoints = analysisResult.key_points.map(item => {
          if (typeof item === 'string') {
            return { title: item, content: '' };
          }
          return {
            title: item.text || item.title || item.name || item.point || '要点',
            content: item.content || item.description || item.detail || '',
            timestamp: item.timestamp || item.time || '',
          };
        });
      } else if (analysisResult.keypoints && Array.isArray(analysisResult.keypoints)) {
        keypoints = analysisResult.keypoints.map(item => {
          if (typeof item === 'string') {
            return { title: item, content: '' };
          }
          return {
            title: item.text || item.title || '要点',
            content: item.content || item.description || '',
            timestamp: item.timestamp || item.time || '',
          };
        });
      }

      // 处理思维导图 - 后端返回的是对象
      const rawMindmap = analysisResult.mindmap || null;
      const mindmapTree = this.normalizeMindmap(rawMindmap);
      const mindmap = mindmapTree ? this.formatMindmap(mindmapTree) : '';

      // 处理章节 - 保留完整对象（标题 + 内容）
      let chapters = [];
      if (analysisResult.chapters && Array.isArray(analysisResult.chapters)) {
        chapters = analysisResult.chapters.map(chapter => {
          if (typeof chapter === 'string') {
            return { title: chapter, content: '' };
          }
          return {
            title: chapter.title || chapter.name || chapter.chapter || '章节',
            content: chapter.content || chapter.description || chapter.summary || '',
            startTime: chapter.start_time || chapter.startTime || '',
            endTime: chapter.end_time || chapter.endTime || '',
          };
        });
      }

      // 处理完整分析
      let fullAnalysis = '';
      if (analysisResult.analysis) {
        fullAnalysis = typeof analysisResult.analysis === 'string'
          ? analysisResult.analysis
          : JSON.stringify(analysisResult.analysis, null, 2);
      } else if (analysisResult.full_analysis) {
        fullAnalysis = typeof analysisResult.full_analysis === 'string'
          ? analysisResult.full_analysis
          : JSON.stringify(analysisResult.full_analysis, null, 2);
      }

      // 构建 wxml 所需的 analysis 对象
      const analysis = this.buildAnalysisObject(result, keypoints, mindmap);
      analysis.mindmapTree = mindmapTree;

      // 获取状态文本
      let statusText = '准备中';
      if (taskStatus === 'completed') statusText = '分析完成';
      else if (taskStatus === 'failed') statusText = '分析失败';
      else if (taskStatus === 'queued') statusText = '排队中';
      else if (taskStatus === 'processing' || taskStatus === 'running') statusText = '分析中';
      else if (taskStatus === 'pending') statusText = '准备中';

      this.setData({
        result: result,
        task: {
          taskId: this.currentTaskId,
          status: taskStatus,
          status_text: statusText,
          url: result.url,
          title: result.title || '视频分析',
        },
        // wxml 模板数据
        analysis: analysis,
        // 扁平数据（用于复制等操作）
        summary: analysisResult.summary || '',
        keypoints: keypoints,
        chapters: chapters,
        mindmap: mindmap,
        fullAnalysis: fullAnalysis,
        isLoading: false,
      });

      // updateProgressDisplay already sets stepStatus, currentStep, currentMessage, etc.
      this.updateProgressDisplay(result);

      // 始终启动轮询，轮询中会自己检查是否完成并停止
      if (this.currentTaskId) {
        this.startProgressTracking();
      }

    } catch (error) {
      console.error('[ERROR] 加载任务详情失败:', error);
      this.setData({
        error: error.message || '加载失败',
        isLoading: false,
      });
    }
  },

  // 将后端导图统一为小程序可渲染的树结构
  normalizeMindmap(mindmapObj) {
    if (!mindmapObj) return null;

    if (typeof mindmapObj === 'string') {
      const text = mindmapObj.trim();
      return text ? { root: '思维导图', branches: [{ title: '内容', items: [text] }] } : null;
    }

    if (Array.isArray(mindmapObj)) {
      const branches = mindmapObj.map((node, index) => this.normalizeMindmapBranch(node, `分支 ${index + 1}`)).filter(Boolean);
      return branches.length ? { root: '思维导图', branches } : null;
    }

    if (typeof mindmapObj !== 'object') return null;

    const root = mindmapObj.root || mindmapObj.title || mindmapObj.text || mindmapObj.centralTopic
      || mindmapObj.central_topic || mindmapObj.mainTopic || mindmapObj.main_topic || '思维导图';
    const rawBranches = mindmapObj.branches || mindmapObj.children || mindmapObj.nodes || mindmapObj.items || [];
    const branches = Array.isArray(rawBranches)
      ? rawBranches.map((branch, index) => this.normalizeMindmapBranch(branch, `分支 ${index + 1}`)).filter(Boolean)
      : [];

    return branches.length ? { root: String(root), branches } : null;
  },

  // 统一单个导图分支结构
  normalizeMindmapBranch(branch, fallbackTitle) {
    if (!branch) return null;

    if (typeof branch === 'string') {
      return { title: branch, items: [] };
    }

    if (typeof branch !== 'object') {
      return { title: String(branch), items: [] };
    }

    const title = branch.title || branch.text || branch.name || branch.label || branch.topic || fallbackTitle;
    const rawItems = branch.items || branch.children || branch.nodes || branch.subtopics || branch.subNodes || [];
    const items = Array.isArray(rawItems)
      ? rawItems.map((item) => {
        if (typeof item === 'string') return item;
        if (!item || typeof item !== 'object') return String(item || '');
        return item.title || item.text || item.name || item.label || item.topic || item.content || '';
      }).filter(Boolean)
      : [];

    return { title: String(title), items };
  },

  // 格式化思维导图为 Markdown 有序列表格式
  formatMindmap(mindmapObj) {
    if (!mindmapObj) return '';

    try {
      if (typeof mindmapObj === 'string') {
        return mindmapObj;
      }

      if (typeof mindmapObj === 'object') {
        let result = '';

        if (mindmapObj.root && Array.isArray(mindmapObj.branches)) {
          result = `1. ${mindmapObj.root}\n`;
          mindmapObj.branches.forEach((branch, index) => {
            result += `   1.${index + 1}. ${branch.title}\n`;
            if (branch.items && Array.isArray(branch.items)) {
              branch.items.forEach((item, itemIndex) => {
                result += `      1.${index + 1}.${itemIndex + 1}. ${item}\n`;
              });
            }
          });
        } else if (mindmapObj.root) {
          result = this.formatMindmapToMarkdown(mindmapObj.root, 0);
        } else if (mindmapObj.centralTopic || mindmapObj.central_topic) {
          const central = mindmapObj.centralTopic || mindmapObj.central_topic;
          result = this.formatMindmapToMarkdown(central, 0);
        } else if (mindmapObj.mainTopic || mindmapObj.main_topic) {
          const main = mindmapObj.mainTopic || mindmapObj.main_topic;
          result = this.formatMindmapToMarkdown(main, 0);
        } else if (mindmapObj.children && Array.isArray(mindmapObj.children)) {
          const mainText = mindmapObj.text || mindmapObj.title || '主题';
          result = `1. ${mainText}\n`;
          mindmapObj.children.forEach((child, index) => {
            result += this.formatMindmapToMarkdown(child, 1, index + 1);
          });
        } else if (mindmapObj.nodes && Array.isArray(mindmapObj.nodes)) {
          result = mindmapObj.nodes.map((node, index) =>
            this.formatMindmapToMarkdown(node, 0, index + 1)
          ).join('\n');
        } else if (Array.isArray(mindmapObj)) {
          result = mindmapObj.map((node, index) =>
            this.formatMindmapToMarkdown(node, 0, index + 1)
          ).join('\n');
        } else {
          result = this.formatObjectToMarkdown(mindmapObj, 0, 1);
        }

        return result;
      }

      return String(mindmapObj);
    } catch (e) {
      console.error('格式化思维导图失败:', e);
      return JSON.stringify(mindmapObj, null, 2);
    }
  },

  // 格式化思维导图为 Markdown 有序列表
  formatMindmapToMarkdown(node, level, parentNumber = 1) {
    if (!node) return '';

    let text = '';
    if (typeof node === 'string') {
      text = node;
    } else if (typeof node === 'object') {
      text = node.text || node.title || node.name || node.label || node.topic
          || node.content || node.idea || node.subject || '节点';
    } else {
      text = String(node);
    }

    const indent = '   '.repeat(level);
    let result = `${indent}${parentNumber}. ${text}\n`;

    const childrenFields = ['children', 'nodes', 'items', 'branches', 'topics', 'subtopics', 'subNodes'];
    let children = null;

    for (const field of childrenFields) {
      if (node[field] && Array.isArray(node[field])) {
        children = node[field];
        break;
      }
    }

    if (children && Array.isArray(children)) {
      children.forEach((child, index) => {
        const childNumber = level === 0 ? index + 1 : `${parentNumber}.${index + 1}`;
        result += this.formatMindmapToMarkdown(child, level + 1, childNumber);
      });
    }

    return result;
  },

  // 将对象转换为 Markdown 有序列表（用于无法识别的结构）
  formatObjectToMarkdown(obj, level, number) {
    if (!obj || typeof obj !== 'object') return `${number}. ${String(obj)}\n`;

    const indent = '   '.repeat(level);
    let result = '';

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const itemNumber = `${number}.${index + 1}`;
        result += `${indent}${itemNumber}. ${typeof item === 'object' ?
          this.formatObjectToMarkdown(item, level + 1, itemNumber) : String(item)}\n`;
      });
    } else {
      Object.keys(obj).forEach((key, index) => {
        const value = obj[key];
        const keyNumber = `${number}.${index + 1}`;
        if (typeof value === 'object') {
          result += `${indent}${keyNumber}. ${key}:\n${this.formatObjectToMarkdown(value, level + 1, keyNumber)}`;
        } else {
          result += `${indent}${keyNumber}. ${key}: ${value}\n`;
        }
      });
    }

    return result;
  },

  // 更新进度显示
  updateProgressDisplay(result) {
    if (!result) {
      return;
    }

    let overallProgress = 0;
    let currentStep = 'extract';
    let currentMessage = result.message || '准备开始...';
    let stepStatus = { extract: 'pending', download: 'pending', transcribe: 'pending', analyze: 'pending' };
    let downloadProgress = null;
    let transcribeProgress = null;

    // 获取任务状态（兼容多种字段名）
    const taskStatus = result.status || result.state || 'pending';

    // 如果任务开始执行，启动计时器
    if (taskStatus === 'running' || taskStatus === 'processing') {
      if (!this._taskStartTime) {
        this._taskStartTime = Date.now() - (this.data.elapsedTime || 0) * 1000;
      }
      if (!this.timerInterval) {
        this.startTimer();
      }
    }

    // 计算步骤名称
    const stepNames = {
      extract: '提取视频信息',
      download: '下载视频文件',
      transcribe: '语音转文字',
      analyze: 'AI 智能分析',
    };

    // 提取子进度（API 返回在 result.progress 中）
    const progressData = result.progress || {};
    const resultData = result.result || {};
    const downloadInfo = progressData.download_progress || resultData.download_progress || {};
    const transcribeInfo = progressData.transcribe_live || resultData.transcribe_live || {};
    downloadProgress = downloadInfo.percent || null;
    transcribeProgress = transcribeInfo.percent || null;
    const downloadSpeed = downloadInfo.speed || '';
    const downloadText = downloadInfo.text || '';

    // 提取 current_step，如果为 null/undefined，则根据 taskStatus 推断
    let inferredStep = progressData.current_step || result.current_step;
    if (!inferredStep) {
      if (taskStatus === 'queued' || taskStatus === 'running') {
        inferredStep = 'extract';  // 队列中或运行中但未初始化，假设在第一步
      } else if (taskStatus === 'completed') {
        inferredStep = 'analyze';  // 已完成，显示最后一步
      }
    }

    if (taskStatus === 'completed') {
      overallProgress = 100;
      currentStep = 'analyze';
      currentMessage = '分析完成';
      stepStatus = { extract: 'completed', download: 'completed', transcribe: 'completed', analyze: 'completed' };
      downloadProgress = 100;
      transcribeProgress = 100;
      // 任务完成，停止计时器
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    } else if (taskStatus === 'failed' || taskStatus === 'error') {
      overallProgress = 0;
      currentStep = 'error';
      currentMessage = result.error_message || result.message || '分析失败';
      // 任务失败，停止计时器
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    } else if (taskStatus === 'processing' || taskStatus === 'running') {
      // 根据推断的 current_step 更新进度和步骤状态
      if (inferredStep === 'extract') {
        overallProgress = 10;
        currentStep = 'extract';
        currentMessage = '正在解析视频信息...';
        stepStatus = { extract: 'active', download: 'pending', transcribe: 'pending', analyze: 'pending' };
      } else if (inferredStep === 'download') {
        overallProgress = 30;
        currentStep = 'download';
        if (downloadProgress !== null) {
          currentMessage = downloadText ? `正在下载视频... ${downloadText}` : `正在下载视频... ${downloadProgress}%`;
          if (!downloadText && downloadSpeed) currentMessage += ` (${downloadSpeed})`;
        } else {
          currentMessage = '正在下载视频...';
        }
        stepStatus = { extract: 'completed', download: 'active', transcribe: 'pending', analyze: 'pending' };
      } else if (inferredStep === 'transcribe') {
        overallProgress = 60;
        currentStep = 'transcribe';
        currentMessage = transcribeProgress !== null ? `正在语音转文字... ${transcribeProgress}%` : '正在语音转文字...';
        stepStatus = { extract: 'completed', download: 'completed', transcribe: 'active', analyze: 'pending' };
      } else if (inferredStep === 'analyze') {
        overallProgress = 90;
        currentStep = 'analyze';
        currentMessage = '正在AI分析...';
        stepStatus = { extract: 'completed', download: 'completed', transcribe: 'completed', analyze: 'active' };
      } else {
        overallProgress = 5;
        currentMessage = result.message || '处理中...';
      }
    } else if (taskStatus === 'queued') {
      overallProgress = 5;
      currentStep = 'extract';
      currentMessage = '等待处理中...';
      stepStatus = { extract: 'pending', download: 'pending', transcribe: 'pending', analyze: 'pending' };
    } else if (taskStatus === 'pending') {
      overallProgress = 0;
      currentMessage = '准备开始...';
    } else {
      // 其他状态（包括 unknown）
      currentMessage = result.message || currentMessage;
      overallProgress = 5;
    }

    // 获取当前步骤名称
    const currentStepName = stepNames[currentStep] || '准备开始...';

    this.setData({
      overallProgress,
      currentStep,
      currentMessage,
      stepStatus,
      currentStepName,
      downloadProgress,
      transcribeProgress,
    });
  },

  // 更新计时器显示
  updateTimerDisplay() {
    const seconds = this.data.elapsedTime || 0;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    this.setData({ elapsedTimeFormat: formatted });
  },

  // 启动计时器（基于任务开始时间计算 elapsed）
  startTimer() {
    // 如果已经有计时器在运行，不重复启动
    if (this.timerInterval) {
      return;
    }

    // 如果没有记录任务开始时间，以当前时刻作为开始时间
    if (!this._taskStartTime) {
      this._taskStartTime = Date.now();
    }

    // 启动新的计时器
    const self = this;
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - self._taskStartTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      self.setData({
        elapsedTime: elapsed,
        elapsedTimeFormat: formatted
      });
    }, 1000);
  },

  // 停止计时器
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  // 启动进度跟踪
  startProgressTracking() {
    this.cleanupInterval();

    const self = this;
    this.progressInterval = setInterval(async () => {
      if (!self.progressInterval || !self.currentTaskId) {
        self.cleanupInterval();
        return;
      }

      try {
        // 使用 getProgress 获取详细进度（包含 download_progress 和 transcribe_live）
        const progressResult = await analysisApi.getProgress(self.currentTaskId);

        // 更新进度显示
        self.updateProgressDisplay(progressResult);

        // 检查是否完成，完成后获取完整结果
        const terminalStates = ['completed', 'failed', 'error'];
        if (terminalStates.includes(progressResult.status)) {
          self.cleanupInterval();
          // 任务完成后，加载完整任务详情
          setTimeout(() => {
            self.loadTaskDetails();
          }, 500);
          return;
        }

        // 更新 store 中的任务状态
        const task = store.getCurrentTask();
        if (task && task.taskId === self.currentTaskId) {
          store.updateTask(task.taskId, {
            status: progressResult.status,
            progress: self.data.overallProgress,
            currentStep: progressResult.progress?.current_step,
          });
        }

      } catch (error) {
        console.error('[ERROR] 获取进度失败:', error);
      }
    }, 2000);
  },

  // 复制结果
  onCopyResult(e) {
    const { field } = e.currentTarget.dataset;

    let text = '';
    if (field === 'summary') {
      text = this.data.summary || this.data.analysis.summary;
    } else if (field === 'keypoints') {
      const kps = this.data.keypoints.length > 0 ? this.data.keypoints : this.data.analysis.keypoints;
      text = kps.map((item, index) => {
        let line = `${index + 1}. ${item.title}`;
        if (item.content || item.description) {
          line += `\n   ${item.content || item.description}`;
        }
        if (item.timestamp) {
          line += `\n   时间: ${item.timestamp}`;
        }
        return line;
      }).join('\n\n');
    } else if (field === 'chapters') {
      text = this.data.chapters.map((item, index) => {
        let line = `${index + 1}. ${item.title}`;
        if (item.content) {
          line += `\n   ${item.content}`;
        }
        if (item.startTime || item.endTime) {
          const time = [];
          if (item.startTime) time.push(`开始: ${item.startTime}`);
          if (item.endTime) time.push(`结束: ${item.endTime}`);
          line += `\n   ${time.join(' ')}`;
        }
        return line;
      }).join('\n\n');
    } else if (field === 'mindmap') {
      text = this.data.mindmap;
    } else if (field === 'fullAnalysis') {
      text = this.data.fullAnalysis;
    }

    if (!text) {
      wx.showToast({
        title: '没有内容可复制',
        icon: 'none',
      });
      return;
    }

    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({
          title: '已复制',
          icon: 'success',
        });
      },
      fail: () => {
        wx.showToast({
          title: '复制失败',
          icon: 'error',
        });
      },
    });
  },

  // 重新分析
  onRetry() {
    this.setData({
      isLoading: true,
      error: null,
      overallProgress: 0,
      swipeClass: '' // 重置左滑状态
    });
    this.loadTaskDetails();
  },

  // 标签页切换
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  // 复制摘要
  onCopySummary() {
    this.onCopyResult({ currentTarget: { dataset: { field: 'summary' } } });
  },

  // 全屏查看思维导图
  onExpandMindmap() {
    const mindmapText = this.data.mindmap || this.data.analysis.mindmap;
    if (!mindmapText) {
      wx.showToast({ title: '暂无可查看的导图', icon: 'none' });
      return;
    }

    wx.setClipboardData({
      data: mindmapText,
      success: () => {
        wx.showToast({ title: '导图文本已复制', icon: 'success' });
      },
    });
  },

  // 预览思维导图
  onPreviewMindmap() {
    this.onExpandMindmap();
  },

  // 复制字幕
  onCopyTranscript() {
    const transcript = this.data.analysis.transcript;
    if (transcript && transcript.segments) {
      const text = transcript.segments.map(seg =>
        `[${seg.start_time || ''}] ${seg.text || ''}`
      ).join('\n');

      if (text) {
        wx.setClipboardData({
          data: text,
          success: () => {
            wx.showToast({ title: '已复制', icon: 'success' });
          },
        });
        return;
      }
    }
    wx.showToast({ title: '暂无字幕内容', icon: 'none' });
  },

  // 跳转到指定时间点（字幕面板）
  onSeekToTime(e) {
    const { time } = e.currentTarget.dataset;
    wx.showToast({ title: `跳转到 ${time}`, icon: 'none' });
  },

  // ===== 分组相关操作 =====
  // 加载分组列表
  async loadGroups() {
    try {
      const groups = await groupsApi.getList();
      this.setData({ groups: groups || [] });
    } catch (error) {
      console.error('[ERROR] 加载分组失败:', error);
      this.setData({ groups: [] });
    }
  },

  // 显示分组选择面板
  onShowGroupPicker() {
    this.loadGroups();
    this.setData({ showGroupSheet: true });
  },

  // 关闭分组选择面板
  onCloseGroupSheet() {
    this.setData({ showGroupSheet: false, showCreateGroupModal: false });
  },

  // 选择分组
  async onSelectGroup(e) {
    const groupId = e.currentTarget.dataset.groupId;
    const targetGroupId = groupId === 'ungrouped' ? null : groupId;

    try {
      await historyApi.updateGroup(this.data.taskId, targetGroupId);

      // 更新当前分析的分组信息
      let groupName = '未分组';
      if (targetGroupId) {
        const group = this.data.groups.find(g => g.id === targetGroupId);
        if (group) {
          groupName = group.name;
        }
      }

      // 先更新UI
      this.setData({
        'analysis.group_id': targetGroupId,
        'analysis.group_name': groupName,
        showGroupSheet: false,
      });

      // 等待500ms后重新加载任务详情，确保后端数据已更新
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.loadTaskDetails();

      wx.showToast({ title: '已更新分组', icon: 'success' });
    } catch (error) {
      console.error('[ERROR onSelectGroup]:', error);
      wx.showToast({ title: error.message || '更新分组失败', icon: 'error' });
    }
  },

  // 显示新建分组弹窗
  onCreateGroup() {
    this.setData({
      showCreateGroupModal: true,
      createGroupForm: { name: '', description: '' },
    });
  },

  // 关闭新建分组弹窗
  onCloseCreateGroupModal() {
    this.setData({ showCreateGroupModal: false });
  },

  // 新建分组名称输入
  onCreateGroupNameInput(e) {
    this.setData({ 'createGroupForm.name': e.detail.value });
  },

  // 新建分组描述输入
  onCreateGroupDescInput(e) {
    this.setData({ 'createGroupForm.description': e.detail.value });
  },

  // 保存新建分组
  async onSaveCreateGroup() {
    const { name, description } = this.data.createGroupForm;
    if (!name.trim()) {
      wx.showToast({ title: '请输入分组名称', icon: 'none' });
      return;
    }

    try {
      const result = await groupsApi.create(name, description);
      wx.showToast({ title: '分组已创建', icon: 'success' });

      // 刷新分组列表
      await this.loadGroups();

      // 将当前分析添加到新分组
      if (result && result.id) {
        await historyApi.updateGroup(this.data.taskId, result.id);
        this.setData({
          'analysis.group_id': result.id,
          'analysis.group_name': name,
        });
      }

      this.setData({ showCreateGroupModal: false, showGroupSheet: false });
    } catch (error) {
      wx.showToast({ title: error.message || '创建分组失败', icon: 'error' });
    }
  },

  // 重新分析（从左滑操作触发）
  onReanalyze() {
    this.setData({ swipeClass: '' }); // 重置左滑状态
    this.onRetry();
  },

  // 删除记录
  onDelete() {
    this.setData({ swipeClass: '' }); // 重置左滑状态
    wx.showModal({
      title: '删除记录',
      content: '确定要删除此分析记录吗？',
      success: (res) => {
        if (res.confirm) {
          // 从 store 中删除任务
          if (this.currentTaskId) {
            store.removeTask(this.currentTaskId);
          }
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => {
            wx.navigateBack();
          }, 500);
        }
      },
    });
  },

  // 播放视频
  onPlayVideo() {
    const videoUrl = this.data.analysis.video.url;
    if (videoUrl) {
      // 复制链接到剪贴板
      wx.setClipboardData({
        data: videoUrl,
        success: () => {
          wx.showToast({ title: '链接已复制', icon: 'success' });
        },
      });
    }
  },
});
