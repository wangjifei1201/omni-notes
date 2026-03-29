import axios, { AxiosError, AxiosInstance } from 'axios';
import type {
  User,
  UserLogin,
  UserRegister,
  UserUpdate,
  Video,
  VideoParseRequest,
  AnalysisResult,
  CreateAnalysisRequest,
  AnalysisHistory,
  HistoryCreateRequest,
  HistoryUpdateRequest,
  HistoryFilterParams,
  HistoryListResponse,
  Group,
  GroupCreateRequest,
  GroupUpdateRequest,
  GroupTree,
  UserConfig,
  ConfigUpdateRequest,
  AIModel,
  TestAIRequest,
  TestAIResponse,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable cookie sending
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // CSRF token can be added here if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError<ApiResponse>) => {
    // Handle 401 unauthorized - but don't redirect for auth check endpoint
    if (error.response?.status === 401) {
      const url = error.config?.url;
      // Don't redirect for auth check endpoint - AuthGuard handles it
      if (url !== '/api/v1/auth/me' && typeof window !== 'undefined') {
        // Only redirect if not already on login page
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Helper function to handle API responses
function handleResponse<T>(response: { data: T }): T {
  // Backend returns data directly, not wrapped in {success, data}
  return response.data;
}

// Auth API
export const authApi = {
  register: async (data: UserRegister): Promise<User> => {
    const response = await apiClient.post<User>('/api/v1/auth/register', data);
    return handleResponse(response);
  },

  login: async (data: UserLogin): Promise<User> => {
    const response = await apiClient.post<User>('/api/v1/auth/login', data);
    return handleResponse(response);
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/api/v1/auth/logout');
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>('/api/v1/auth/me');
    return handleResponse(response);
  },

  updateProfile: async (data: UserUpdate): Promise<User> => {
    const response = await apiClient.put<User>('/api/v1/auth/profile', data);
    return handleResponse(response);
  },

  changePassword: async (oldPassword: string, newPassword: string): Promise<void> => {
    await apiClient.post('/api/v1/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
    });
  },

  createGuest: async (): Promise<User> => {
    const response = await apiClient.post<User>('/api/v1/auth/guest');
    return handleResponse(response);
  },
};

// Video API
export const videoApi = {
  parse: async (data: VideoParseRequest): Promise<Video> => {
    const response = await apiClient.post<Video>(
      '/api/v1/videos/parse',
      data
    );
    return handleResponse(response);
  },

  getById: async (id: number): Promise<Video> => {
    const response = await apiClient.get<Video>(`/api/v1/videos/${id}`);
    return handleResponse(response);
  },

  getSubtitles: async (id: number): Promise<Video> => {
    const response = await apiClient.get<Video>(
      `/api/v1/videos/${id}/subtitles`
    );
    return handleResponse(response);
  },
};

// Analysis API
export const analysisApi = {
  create: async (data: CreateAnalysisRequest): Promise<string> => {
    const response = await apiClient.post<{ task_id: string }>(
      '/api/v1/analysis',
      data
    );
    return handleResponse(response).task_id;
  },

  getProgress: async (taskId: string): Promise<Response> => {
    return apiClient.get(`/api/v1/analysis/${taskId}/progress`, {
      responseType: 'stream',
    });
  },

  getById: async (id: number): Promise<AnalysisResult> => {
    const response = await apiClient.get<AnalysisResult>(
      `/api/v1/analysis/${id}`
    );
    return handleResponse(response);
  },

  getByVideoId: async (videoId: number): Promise<AnalysisResult[]> => {
    const response = await apiClient.get<AnalysisResult[]>(
      `/api/v1/analysis/video/${videoId}`
    );
    return handleResponse(response);
  },

  cancel: async (taskId: string): Promise<void> => {
    await apiClient.post(`/api/v1/analysis/${taskId}/cancel`);
  },

  getModels: async (): Promise<AIModel[]> => {
    const response = await apiClient.get<AIModel[]>('/api/v1/analysis/models');
    return handleResponse(response);
  },
};

// History API
export const historyApi = {
  create: async (data: HistoryCreateRequest): Promise<AnalysisHistory> => {
    const response = await apiClient.post<AnalysisHistory>(
      '/api/v1/history',
      data
    );
    return handleResponse(response);
  },

  getById: async (id: number): Promise<AnalysisHistory> => {
    const response = await apiClient.get<AnalysisHistory>(
      `/api/v1/history/${id}`
    );
    return handleResponse(response);
  },

  getList: async (params?: HistoryFilterParams): Promise<HistoryListResponse> => {
    const response = await apiClient.get<HistoryListResponse>('/api/v1/history', {
      params,
    });
    return handleResponse(response);
  },

  update: async (id: number, data: HistoryUpdateRequest): Promise<AnalysisHistory> => {
    const response = await apiClient.put<AnalysisHistory>(
      `/api/v1/history/${id}`,
      data
    );
    return handleResponse(response);
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/v1/history/${id}`);
  },

  batchDelete: async (ids: number[]): Promise<void> => {
    await apiClient.post('/api/v1/history/batch-delete', { ids });
  },
};

// Group API
export const groupApi = {
  create: async (data: GroupCreateRequest): Promise<Group> => {
    const response = await apiClient.post<Group>('/api/v1/groups', data);
    return handleResponse(response);
  },

  getById: async (id: number): Promise<Group> => {
    const response = await apiClient.get<Group>(`/api/v1/groups/${id}`);
    return handleResponse(response);
  },

  getList: async (): Promise<Group[]> => {
    const response = await apiClient.get<Group[]>('/api/v1/groups');
    return handleResponse(response);
  },

  getTree: async (): Promise<GroupTree[]> => {
    const response = await apiClient.get<GroupTree[]>('/api/v1/groups/tree');
    return handleResponse(response);
  },

  update: async (id: number, data: GroupUpdateRequest): Promise<Group> => {
    const response = await apiClient.put<Group>(`/api/v1/groups/${id}`, data);
    return handleResponse(response);
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/v1/groups/${id}`);
  },

  moveHistory: async (groupId: number, historyIds: number[]): Promise<void> => {
    await apiClient.post(`/api/v1/groups/${groupId}/move`, { history_ids: historyIds });
  },
};

// Config API
export const configApi = {
  get: async (): Promise<UserConfig> => {
    const response = await apiClient.get<UserConfig>('/api/v1/config');
    return handleResponse(response);
  },

  update: async (data: ConfigUpdateRequest): Promise<UserConfig> => {
    const response = await apiClient.put<UserConfig>('/api/v1/config', data);
    return handleResponse(response);
  },

  testAI: async (data: TestAIRequest): Promise<TestAIResponse> => {
    const response = await apiClient.post<TestAIResponse>(
      '/api/v1/config/test-ai',
      data
    );
    return handleResponse(response);
  },
};

export default apiClient;
