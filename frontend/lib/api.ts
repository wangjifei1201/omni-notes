import axios, { AxiosError, AxiosInstance } from 'axios';
import type {
  User,
  UserLogin,
  UserRegister,
  Video,
  VideoParseRequest,
  AnalysisResult,
  CreateAnalysisRequest,
  HistoryFilterParams,
  HistoryListResponse,
  Group,
  GroupCreateRequest,
  GroupUpdateRequest,
  UserConfig,
  ConfigUpdateRequest,
  AIModel,
  ApiResponse,
} from '@/types';

// Use relative URL so requests go through Next.js proxy (same-origin),
// avoiding cross-origin cookie issues. The proxy is configured in next.config.mjs.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
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

  getProgress: async (taskId: string): Promise<{
    step: string;
    step_status: 'pending' | 'running' | 'completed' | 'error';
    percent: number;
    message: string;
  }> => {
    const response = await apiClient.get(`/api/v1/analysis/${taskId}/status`);
    return handleResponse(response);
  },

  getById: async (taskId: string): Promise<AnalysisResult> => {
    const response = await apiClient.get<AnalysisResult>(
      `/api/v1/analysis/${taskId}`
    );
    return handleResponse(response);
  },

  getModels: async (): Promise<AIModel[]> => {
    const response = await apiClient.get<AIModel[]>('/api/v1/analysis/models');
    return handleResponse(response);
  },
};

// History API
export const historyApi = {
  getList: async (params?: HistoryFilterParams): Promise<HistoryListResponse> => {
    const response = await apiClient.get<HistoryListResponse>('/api/v1/history', {
      params,
    });
    return handleResponse(response);
  },

  delete: async (taskId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/history/${taskId}`);
  },

  search: async (keyword: string, page?: number, limit?: number): Promise<HistoryListResponse> => {
    const response = await apiClient.get<HistoryListResponse>('/api/v1/history/search', {
      params: { keyword, page, limit },
    });
    return handleResponse(response);
  },
};

// Group API
export const groupApi = {
  create: async (data: GroupCreateRequest): Promise<Group> => {
    const response = await apiClient.post<Group>('/api/v1/groups', data);
    return handleResponse(response);
  },

  getList: async (): Promise<Group[]> => {
    const response = await apiClient.get<Group[]>('/api/v1/groups');
    return handleResponse(response);
  },

  getByTask: async (taskId: string): Promise<Group[]> => {
    const response = await apiClient.get<Group[]>(`/api/v1/groups/by-task/${taskId}`);
    return handleResponse(response);
  },

  update: async (id: string, data: GroupUpdateRequest): Promise<Group> => {
    const response = await apiClient.put<Group>(`/api/v1/groups/${id}`, data);
    return handleResponse(response);
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/groups/${id}`);
  },

  addTask: async (groupId: string, taskId: string): Promise<void> => {
    await apiClient.post(`/api/v1/groups/${groupId}/tasks/${taskId}`);
  },

  removeTask: async (groupId: string, taskId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/groups/${groupId}/tasks/${taskId}`);
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
};

export default apiClient;
