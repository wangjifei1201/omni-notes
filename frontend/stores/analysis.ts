import { create } from 'zustand';
import type { Video, AnalysisResult, AnalysisType, AnalysisStatus } from '@/types';

export interface AnalysisTask {
  taskId: string;
  videoId?: string;
  type: AnalysisType;
  status: AnalysisStatus;
  progress: number;
  message: string;
  result?: AnalysisResult;
  error?: string;
  createdAt: string;
}

interface AnalysisState {
  // Current video being analyzed
  currentVideo: Video | null;
  currentTask: AnalysisTask | null;
  currentResult: AnalysisResult | null;

  // Active tasks
  activeTasks: AnalysisTask[];

  // Loading states
  isParsing: boolean;
  isAnalyzing: boolean;

  // UI states
  selectedAnalysisType: AnalysisType;
  customPrompt: string;

  // Actions
  setCurrentVideo: (video: Video | null) => void;
  setCurrentTask: (task: AnalysisTask | null) => void;
  setCurrentResult: (result: AnalysisResult | null) => void;
  addTask: (task: AnalysisTask) => void;
  updateTask: (taskId: string, updates: Partial<AnalysisTask>) => void;
  removeTask: (taskId: string) => void;
  setParsing: (parsing: boolean) => void;
  setAnalyzing: (analyzing: boolean) => void;
  setSelectedType: (type: AnalysisType) => void;
  setCustomPrompt: (prompt: string) => void;
  clearCurrent: () => void;
  cancelTask: (taskId: string) => void;
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  currentVideo: null,
  currentTask: null,
  currentResult: null,
  activeTasks: [],
  isParsing: false,
  isAnalyzing: false,
  selectedAnalysisType: 'comprehensive',
  customPrompt: '',

  setCurrentVideo: (video) => set({ currentVideo: video }),
  setCurrentTask: (task) => set({ currentTask: task }),
  setCurrentResult: (result) => set({ currentResult: result }),

  addTask: (task) =>
    set((state) => ({
      activeTasks: [...state.activeTasks, task],
    })),

  updateTask: (taskId, updates) =>
    set((state) => {
      const newTasks = state.activeTasks.map((task) =>
        task.taskId === taskId ? { ...task, ...updates } : task
      );

      // Also update current task if it matches
      const currentTaskUpdate =
        state.currentTask?.taskId === taskId
          ? { ...state.currentTask, ...updates }
          : state.currentTask;

      return {
        activeTasks: newTasks,
        currentTask: currentTaskUpdate,
      };
    }),

  removeTask: (taskId) =>
    set((state) => ({
      activeTasks: state.activeTasks.filter((task) => task.taskId !== taskId),
    })),

  setParsing: (parsing) => set({ isParsing: parsing }),
  setAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),
  setSelectedType: (type) => set({ selectedAnalysisType: type }),
  setCustomPrompt: (prompt) => set({ customPrompt: prompt }),

  clearCurrent: () =>
    set({
      currentVideo: null,
      currentTask: null,
      currentResult: null,
    }),

  cancelTask: (taskId) =>
    set((state) => ({
      activeTasks: state.activeTasks.filter((task) => task.taskId !== taskId),
      currentTask:
        state.currentTask?.taskId === taskId ? null : state.currentTask,
    })),
}));
