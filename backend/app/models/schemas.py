"""
Pydantic schemas for request/response validation.
"""

from datetime import datetime
from typing import Optional, List, Literal, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


# ============== User Schemas ==============


class UserBase(BaseModel):
    """Base user schema."""

    model_config = ConfigDict(from_attributes=True)

    username: str = Field(..., min_length=3, max_length=20)


class UserCreate(UserBase):
    """User creation schema."""

    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    """User login schema."""

    model_config = ConfigDict(from_attributes=True)

    username: str
    password: str


class UserResponse(UserBase):
    """User response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    is_guest: bool
    usage_count: int
    created_at: datetime
    last_login_at: Optional[datetime] = None


class GuestUserResponse(BaseModel):
    """Guest user creation response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    is_guest: bool
    usage_count: int
    session_id: Optional[str] = None  # 添加session_id字段


# ============== Video Schemas ==============


class VideoInfo(BaseModel):
    """Video information schema."""

    model_config = ConfigDict(from_attributes=True)

    platform: Literal["bilibili", "douyin"]
    video_id: str
    title: str
    author: str
    author_id: Optional[str] = None
    duration: int  # seconds
    cover: str
    original_url: str
    desc: Optional[str] = None


class VideoResolveRequest(BaseModel):
    """Video URL resolve request."""

    url: str = Field(..., min_length=1)


# ============== Analysis Schemas ==============


class AnalysisProgress(BaseModel):
    """Analysis progress schema."""

    model_config = ConfigDict(from_attributes=True)

    step: Literal["extract", "download", "transcribe", "analyze"]
    step_status: Literal["pending", "running", "completed", "error", "skipped"]
    percent: int = Field(..., ge=0, le=100)
    message: str


class AnalysisResult(BaseModel):
    """AI analysis result schema."""

    model_config = ConfigDict(from_attributes=True)

    summary: str
    key_points: List[Dict[str, Any]]
    chapters: List[Dict[str, Any]]
    mindmap: Dict[str, Any]


class AnalysisTaskCreate(BaseModel):
    """Analysis task creation request."""

    url: str = Field(..., min_length=1)
    use_whisper: Optional[bool] = None  # None = use system config
    whisper_model: Optional[Literal["tiny", "base", "small", "medium"]] = (
        None  # None = use system config
    )
    analysis_type: Optional[
        Literal[
            "comprehensive", "summary", "key_points", "chapters", "mindmap", "custom"
        ]
    ] = "comprehensive"
    custom_prompt: Optional[str] = None


class QueueInfo(BaseModel):
    """Queue information for pending tasks."""

    model_config = ConfigDict(from_attributes=True)

    position: int
    estimated_wait_seconds: int
    ahead_count: int


class AnalysisTaskResponse(BaseModel):
    """Analysis task response schema."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    task_id: str
    platform: str
    video_id: str
    title: Optional[str]
    author: Optional[str]
    cover: Optional[str]
    duration: Optional[int]
    status: str
    queue_position: int = 0
    estimated_wait_seconds: int = 0
    result: Optional[AnalysisResult] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    current_step: Optional[str] = (
        None  # 当前步骤: extract, download, transcribe, analyze
    )
    message: Optional[str] = None  # 进度消息


class AnalysisTaskDetailResponse(AnalysisTaskResponse):
    """Detailed analysis task response with transcript."""

    transcript: Optional[str] = None
    error_message: Optional[str] = None  # 错误信息（如果有）


class AnalysisProgressEvent(BaseModel):
    """SSE progress event."""

    step: str
    step_status: str
    percent: int
    message: str


class QueueStatusEvent(BaseModel):
    """SSE queue status event."""

    status: str
    position: int
    estimated_wait_seconds: int
    message: str


# ============== Group Schemas ==============


class GroupCreate(BaseModel):
    """Group creation request."""

    name: str = Field(..., min_length=1, max_length=50)


class GroupUpdate(BaseModel):
    """Group update request."""

    name: Optional[str] = Field(None, min_length=1, max_length=50)
    sort_order: Optional[int] = None


class GroupResponse(BaseModel):
    """Group response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    sort_order: int
    item_count: int = 0


# ============== History Schemas ==============


class HistoryItem(BaseModel):
    """History item schema."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    platform: str
    title: Optional[str]
    author: Optional[str]
    cover: Optional[str]
    duration: Optional[int]
    status: str
    created_at: datetime
    group_ids: List[str] = []
    summary: Optional[str] = None  # AI分析摘要


class HistoryListResponse(BaseModel):
    """History list response."""

    items: List[HistoryItem]
    total: int


# ============== Config Schemas ==============


class ConfigResponse(BaseModel):
    """Configuration response."""

    model_config = ConfigDict(from_attributes=True)

    ai_provider: Literal["bailian", "openai"]
    base_url: Optional[str]
    model: str
    use_whisper: bool
    whisper_model: str
    proxy_enabled: bool
    proxy_type: Optional[str]
    proxy_url: Optional[str]
    proxy_api_url: Optional[str]


class ConfigUpdate(BaseModel):
    """Configuration update request."""

    ai_provider: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None
    use_whisper: Optional[bool] = None
    whisper_model: Optional[str] = None
    proxy: Optional[Dict[str, Any]] = None


class CookieConfigResponse(BaseModel):
    """Cookie configuration response."""

    model_config = ConfigDict(from_attributes=True)

    bilibili_cookie: Optional[str] = None


class CookieConfigUpdate(BaseModel):
    """Cookie configuration update request."""

    bilibili_cookie: Optional[str] = None


# ============== Error Schemas ==============


class ErrorResponse(BaseModel):
    """Error response schema."""

    error: str
    message: str
    retry_after: Optional[int] = None
