// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  detail?: string;
}

// User Types
export interface User {
  id: string;
  username: string;
  is_guest: boolean;
  usage_count: number;
  created_at: string;
  last_login_at?: string;
}

export interface UserRegister {
  username: string;
  password: string;
}

export interface UserLogin {
  username: string;
  password: string;
}

export interface UserUpdate {
  email?: string;
  avatar?: string;
}

// Video Types (matches backend VideoInfo)
export interface Video {
  platform: 'bilibili' | 'douyin';
  video_id: string;
  title: string;
  author: string;
  author_id?: string;
  duration: number;
  cover: string;
  original_url: string;
  desc?: string;
}

export interface VideoParseRequest {
  url: string;
}

// Analysis Types
export type AnalysisStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AnalysisType =
  | 'comprehensive'
  | 'summary'
  | 'key_points'
  | 'chapters'
  | 'mindmap'
  | 'custom';

// Backend AI analysis result structure
export interface AnalysisResultData {
  summary?: string;
  key_points?: Array<{ point: string; detail: string }>;
  chapters?: Array<{ time: string; title: string; summary: string }>;
  mindmap?: MindMapNode;
}

export interface MindMapNode {
  root?: string;
  title?: string;
  branches?: Array<{ title: string; items: string[] }>;
  children?: MindMapNode[];
}

// Backend AnalysisTaskResponse / AnalysisTaskDetailResponse
export interface AnalysisResult {
  task_id: string;
  platform: string;
  video_id: string;
  title?: string;
  author?: string;
  cover?: string;
  duration?: number;
  status: string;
  queue_position?: number;
  estimated_wait_seconds?: number;
  result?: AnalysisResultData;
  transcript?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface CreateAnalysisRequest {
  url: string;
  use_whisper?: boolean;
  whisper_model?: 'tiny' | 'base' | 'small' | 'medium';
  analysis_type?: AnalysisType;
  custom_prompt?: string;
}

// Analysis Progress Types
export interface AnalysisProgress {
  task_id?: string;
  event?: string;
  status?: AnalysisStatus;
  step?: string;
  step_status?: string;
  progress?: number;
  percent?: number;
  message?: string;
  result?: AnalysisResult;
  data?: {
    step?: string;
    step_status?: string;
    percent?: number;
    message?: string;
    position?: number;
    estimated_wait_seconds?: number;
  };
}

// History Types (matches backend HistoryItem)
export interface AnalysisHistory {
  id: string;
  platform: string;
  title?: string;
  author?: string;
  cover?: string;
  duration?: number;
  status: string;
  created_at: string;
  group_ids: string[];
}

export interface HistoryFilterParams {
  group_id?: string;
  search?: string;
  sort_by?: 'created_at' | 'updated_at';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface HistoryListResponse {
  total: number;
  items: AnalysisHistory[];
}

// Group Types (matches backend GroupResponse)
export interface Group {
  id: string;
  name: string;
  sort_order: number;
  item_count: number;
}

export interface GroupCreateRequest {
  name: string;
}

export interface GroupUpdateRequest {
  name?: string;
  sort_order?: number;
}

// Config Types (matches backend ConfigResponse)
export interface UserConfig {
  ai_provider: 'bailian' | 'openai';
  base_url?: string;
  model: string;
  use_whisper: boolean;
  whisper_model: string;
  proxy_enabled: boolean;
  proxy_type?: string;
  proxy_url?: string;
  proxy_api_url?: string;
}

export interface ConfigUpdateRequest {
  ai_provider?: string;
  api_key?: string;
  base_url?: string;
  model?: string;
  use_whisper?: boolean;
  whisper_model?: string;
  proxy?: {
    enabled: boolean;
    type?: string;
    url?: string;
  };
}

// AI Model Types
export interface AIModel {
  id: string;
  name: string;
  description?: string;
  provider: string;
}

// UI Types
export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
}

export type Theme = 'light' | 'dark' | 'system';
