"""
Local transcript cache service.

Caches video transcription results on disk so that re-analysis of the same
video (e.g. after an AI call failure) skips the download and transcribe steps.

Cache key: {platform}_{video_id}
Storage: one JSON file per video under TRANSCRIPT_CACHE_DIR.
"""
import json
import time
from pathlib import Path
from typing import Optional

from app.config import settings


class TranscriptCacheService:
    """Manages local transcript cache files."""

    def __init__(self):
        self._cache_dir: Optional[Path] = None

    @property
    def cache_dir(self) -> Path:
        if self._cache_dir is None:
            base = Path(settings.transcript_cache_dir)
            base.mkdir(parents=True, exist_ok=True)
            self._cache_dir = base
        return self._cache_dir

    @staticmethod
    def _cache_key(platform: str, video_id: str) -> str:
        """Build a safe filename from platform + video_id."""
        # Replace characters that could be problematic in filenames
        safe_vid = video_id.replace("/", "_").replace("\\", "_")
        return f"{platform}_{safe_vid}"

    def _cache_path(self, platform: str, video_id: str) -> Path:
        key = self._cache_key(platform, video_id)
        return self.cache_dir / f"{key}.json"

    def get(self, platform: str, video_id: str) -> Optional[str]:
        """
        Retrieve cached transcript for a video.

        Returns:
            Transcript text if cached, None otherwise.
        """
        path = self._cache_path(platform, video_id)
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            transcript = data.get("transcript")
            if transcript and isinstance(transcript, str) and transcript.strip():
                print(f"[缓存] 命中转录缓存: {platform}/{video_id}")
                return transcript
            return None
        except (json.JSONDecodeError, OSError) as e:
            print(f"[缓存] 读取缓存失败: {e}")
            return None

    def save(self, platform: str, video_id: str, transcript: str) -> None:
        """
        Save transcript to local cache.

        Args:
            platform: Video platform (bilibili, douyin)
            video_id: Video ID (BV号 etc.)
            transcript: Transcript text with timestamps
        """
        path = self._cache_path(platform, video_id)
        data = {
            "platform": platform,
            "video_id": video_id,
            "transcript": transcript,
            "cached_at": time.time(),
        }
        try:
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"[缓存] 已保存转录缓存: {platform}/{video_id}")
        except OSError as e:
            print(f"[缓存] 保存缓存失败: {e}")

    def exists(self, platform: str, video_id: str) -> bool:
        """Check if a cached transcript exists for the given video."""
        return self._cache_path(platform, video_id).exists()

    def delete(self, platform: str, video_id: str) -> bool:
        """Delete cached transcript for a video."""
        path = self._cache_path(platform, video_id)
        if path.exists():
            try:
                path.unlink()
                return True
            except OSError:
                return False
        return False


# Global instance
transcript_cache = TranscriptCacheService()
