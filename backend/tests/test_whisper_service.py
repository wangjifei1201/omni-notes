import asyncio

import pytest
from fastapi import HTTPException

from app.services.whisper_service import WhisperService


def test_download_audio_retries_without_proxy_when_proxy_tunnel_fails(monkeypatch):
    service = WhisperService()
    calls = []

    async def fake_run_yt_dlp(cmd, output_path, progress_callback=None):
        calls.append(cmd)
        if "--proxy" in cmd:
            raise HTTPException(
                status_code=500,
                detail="下载音频失败: ERROR: [download] Got error: ('Unable to connect to proxy', OSError('Tunnel connection failed: 517 Proxy Setup Failed'))",
            )
        return output_path

    monkeypatch.setattr(service, "_run_yt_dlp_download", fake_run_yt_dlp)

    result = asyncio.run(service.download_audio(
        video_url="https://www.bilibili.com/video/BV1234567890",
        task_id="task_proxy_retry",
        proxy="http://127.0.0.1:7890",
    ))

    assert result == service._get_audio_path("task_proxy_retry")
    assert len(calls) == 2
    assert "--proxy" in calls[0]
    assert "--proxy" not in calls[1]


def test_download_audio_does_not_retry_non_proxy_errors(monkeypatch):
    service = WhisperService()
    calls = []

    async def fake_run_yt_dlp(cmd, output_path, progress_callback=None):
        calls.append(cmd)
        raise HTTPException(status_code=500, detail="下载音频失败: 视频不存在")

    monkeypatch.setattr(service, "_run_yt_dlp_download", fake_run_yt_dlp)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(service.download_audio(
            video_url="https://www.bilibili.com/video/BV1234567890",
            task_id="task_non_proxy_error",
            proxy="http://127.0.0.1:7890",
        ))

    assert exc_info.value.detail == "下载音频失败: 视频不存在"
    assert len(calls) == 1


def test_proxy_connection_error_detection_is_case_insensitive():
    assert WhisperService._is_proxy_connection_error(
        "proxyerror: connect tunnel failed with 517 proxy setup failed"
    )
