"""
AI analysis service for generating video summaries, key points, chapters, and mindmaps.
Supports multiple AI providers: Bailian (Tongyi Qianwen) and OpenAI.
"""
import json
from typing import Dict, Any, List, Optional

import httpx
from fastapi import HTTPException

from app.config import settings


class AIService:
    """Service for AI-powered video content analysis."""

    # Prompt templates
    ANALYSIS_PROMPT = """请对以下视频字幕内容进行深度分析，提取核心信息并以结构化格式返回。

字幕内容：
{transcript}

重要：请先对字幕进行纠错处理，然后再进行分析：
1. 修正语音识别错误（同音字、错别字等）
2. 修正语法和标点符号
3. 优化表达使其更符合书面语规范
4. 在纠错后的内容基础上进行分析

请按以下JSON格式返回分析结果（仅返回JSON，不要其他文字）：
{{
    "summary": "视频的核心摘要，3-5句话概括主要内容",
    "key_points": [
        {{"point": "核心观点1", "detail": "详细说明"}},
        {{"point": "核心观点2", "detail": "详细说明"}},
        {{"point": "核心观点3", "detail": "详细说明"}},
        {{"point": "核心观点4", "detail": "详细说明"}},
        {{"point": "核心观点5", "detail": "详细说明"}}
    ],
    "chapters": [
        {{"time": "00:00", "title": "章节标题1", "summary": "章节内容摘要"}},
        {{"time": "05:30", "title": "章节标题2", "summary": "章节内容摘要"}},
        {{"time": "12:00", "title": "章节标题3", "summary": "章节内容摘要"}}
    ],
    "mindmap": {{
        "root": "视频主题",
        "branches": [
            {{
                "title": "分支主题1",
                "items": ["子项1", "子项2", "子项3"]
            }},
            {{
                "title": "分支主题2",
                "items": ["子项1", "子项2", "子项3"]
            }},
            {{
                "title": "分支主题3",
                "items": ["子项1", "子项2", "子项3"]
            }}
        ]
    }}
}}

要求：
1. 请先对字幕进行纠错，然后基于纠错后的内容分析
2. summary 要简洁有力，突出视频核心价值
3. key_points 提取3-7个核心观点，每个包含简短标题和详细说明
4. chapters 根据内容逻辑划分3-8个章节，包含时间戳、标题和摘要
5. mindmap 构建思维导图结构，包含中心主题、分支主题和子项
6. 所有内容基于纠错后的字幕文本，不要添加文本中没有的信息
7. 返回必须是合法的JSON格式"""

    REGENERATE_PROMPT = """请重新分析以下视频字幕，从新的角度提取信息：

字幕内容：
{transcript}

请提供：
1. 新的摘要视角
2. 不同的核心要点
3. 更详细的章节划分
4. 更全面的思维导图

格式要求同上。"""

    CORRECT_TRANSCRIPT_PROMPT = """请对以下视频字幕进行纠错和优化。这是一个语音识别结果，可能包含同音字错误、错别字、标点符号问题等。

原始字幕：
{transcript}

请执行以下操作：
1. 修正明显的同音字错误（如：在/再，的/得/地，做/作等）
2. 修正错别字和语法错误
3. 优化标点符号，使其更符合书面语规范
4. 保持原文的段落结构，不要改变内容意思
5. 保持原文的语言风格（口语化或书面语）

请直接返回修正后的字幕文本，不要添加任何解释或格式标记。"""

    def __init__(self):
        self.provider = settings.ai_provider
        self.base_url = settings.ai_base_url
        self.api_key = settings.ai_api_key
        self.model = settings.ai_model

    def _get_api_url(self) -> str:
        """
        Build the full API endpoint URL.

        If base_url is provided, treat it as an OpenAI-compatible base URL
        and append /chat/completions.  Otherwise fall back to the provider
        default.
        """
        if self.base_url:
            url = self.base_url.rstrip("/")
            # If the user already gave a full endpoint, use it as-is
            if url.endswith("/chat/completions"):
                return url
            # Otherwise append the standard OpenAI path
            return f"{url}/chat/completions"
        return self._get_default_url()

    @property
    def _use_openai_format(self) -> bool:
        """Whether to use OpenAI-compatible request/response format.

        True when a custom base_url is provided (OpenAI-compatible endpoint)
        or when the provider is explicitly 'openai'.
        """
        return bool(self.base_url) or self.provider == "openai"

    def _get_headers(self) -> Dict[str, str]:
        """Get HTTP headers for API requests."""
        headers = {
            "Content-Type": "application/json",
        }

        if self.provider == "openai" or self.base_url:
            headers["Authorization"] = f"Bearer {self.api_key}"
        elif self.provider == "bailian":
            headers["Authorization"] = f"Bearer {self.api_key}"

        return headers

    def _build_request_body(
        self,
        prompt: str,
        temperature: float = 0.7
    ) -> Dict[str, Any]:
        """Build request body for AI API."""
        if self._use_openai_format:
            # OpenAI-compatible format (also used for custom base_url)
            return {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": "你是一个专业的视频内容分析助手，擅长从字幕中提取关键信息并生成结构化分析。"},
                    {"role": "user", "content": prompt}
                ],
                "temperature": temperature,
                "max_tokens": 4000
            }
        elif self.provider == "bailian":
            # Tongyi Qianwen native API format (only when no custom base_url)
            return {
                "model": self.model,
                "input": {
                    "messages": [
                        {"role": "system", "content": "你是一个专业的视频内容分析助手，擅长从字幕中提取关键信息并生成结构化分析。"},
                        {"role": "user", "content": prompt}
                    ]
                },
                "parameters": {
                    "temperature": temperature,
                    "max_tokens": 4000,
                    "result_format": "message"
                }
            }
        else:
            raise ValueError(f"Unsupported AI provider: {self.provider}")

    def _extract_content(self, response: Dict[str, Any]) -> str:
        """Extract content from AI API response."""
        try:
            if self._use_openai_format:
                return response["choices"][0]["message"]["content"]
            elif self.provider == "bailian":
                # Bailian native API format
                output = response.get("output", {})
                if "text" in output:
                    return output["text"]
                elif "choices" in output:
                    return output["choices"][0]["message"]["content"]
                else:
                    return str(output)
        except (KeyError, IndexError) as e:
            raise HTTPException(
                status_code=500,
                detail=f"无法解析AI响应: {str(e)}"
            )

    def _parse_json_response(self, content: str) -> Dict[str, Any]:
        """Parse JSON from AI response, handling markdown code blocks."""
        # Remove markdown code block markers if present
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]

        content = content.strip()

        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            # Try to extract JSON from the response
            try:
                # Find JSON object in the text
                start = content.find("{")
                end = content.rfind("}")
                if start != -1 and end != -1:
                    return json.loads(content[start:end+1])
            except:
                pass

            raise HTTPException(
                status_code=500,
                detail=f"AI返回的JSON格式无效: {str(e)}"
            )

    async def analyze(
        self,
        transcript: str,
        temperature: float = 0.7
    ) -> Dict[str, Any]:
        """
        Analyze video transcript and generate structured content.

        Args:
            transcript: Video transcript text
            temperature: AI temperature (creativity)

        Returns:
            Analysis result dictionary
        """
        if not self.api_key:
            raise HTTPException(
                status_code=500,
                detail="AI API密钥未配置，请在设置中配置"
            )

        # Build prompt
        prompt = self.ANALYSIS_PROMPT.format(transcript=transcript[:15000])  # Limit transcript length

        # Build request
        headers = self._get_headers()
        body = self._build_request_body(prompt, temperature)

        # Make API request
        url = self._get_api_url()
        print(f"[AI] 请求: {url} model={self.model} format={'openai' if self._use_openai_format else 'bailian'}")

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    url,
                    headers=headers,
                    json=body
                )
                response.raise_for_status()
                data = response.json()

                # Extract content
                content = self._extract_content(data)

                # Parse JSON
                result = self._parse_json_response(content)

                return result

        except httpx.TimeoutException:
            raise HTTPException(status_code=408, detail="AI分析超时，请稍后重试")
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"AI API请求失败: {e.response.text}"
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"AI分析失败: {str(e)}")

    async def regenerate(
        self,
        transcript: str,
        temperature: float = 0.8
    ) -> Dict[str, Any]:
        """
        Regenerate analysis with different perspective.

        Args:
            transcript: Video transcript text
            temperature: Higher temperature for more variation

        Returns:
            Analysis result dictionary
        """
        prompt = self.REGENERATE_PROMPT.format(transcript=transcript[:15000])

        headers = self._get_headers()
        body = self._build_request_body(prompt, temperature)
        url = self._get_api_url()

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    url,
                    headers=headers,
                    json=body
                )
                response.raise_for_status()
                data = response.json()

                content = self._extract_content(data)
                result = self._parse_json_response(content)

                return result

        except httpx.TimeoutException:
            raise HTTPException(status_code=408, detail="AI分析超时")
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"AI API请求失败: {e.response.text}"
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"AI分析失败: {str(e)}")

    def _get_default_url(self) -> str:
        """Get default API URL based on provider."""
        if self.provider == "openai":
            return "https://api.openai.com/v1/chat/completions"
        elif self.provider == "bailian":
            return "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
        else:
            raise ValueError(f"Unknown provider: {self.provider}")

    def validate_config(self) -> bool:
        """Validate AI service configuration."""
        return bool(self.api_key and self.model)

    async def correct_transcript(
        self,
        transcript: str,
        temperature: float = 0.3
    ) -> str:
        """
        Correct transcript errors using AI.

        Args:
            transcript: Raw transcript from speech recognition
            temperature: Lower temperature for more consistent corrections

        Returns:
            Corrected transcript
        """
        if not self.api_key:
            raise HTTPException(
                status_code=500,
                detail="AI API密钥未配置，请在设置中配置"
            )

        # Build prompt
        prompt = self.CORRECT_TRANSCRIPT_PROMPT.format(transcript=transcript[:15000])

        # Build request
        headers = self._get_headers()
        body = self._build_request_body(prompt, temperature)

        # Make API request
        url = self._get_api_url()

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    url,
                    headers=headers,
                    json=body
                )
                response.raise_for_status()
                data = response.json()

                # Extract content
                content = self._extract_content(data)

                # Clean up the response - remove markdown code blocks if present
                content = content.strip()
                if content.startswith("```"):
                    lines = content.split("\n")
                    if len(lines) > 2:
                        content = "\n".join(lines[1:-1])
                    else:
                        content = content.replace("```", "").strip()

                return content.strip()

        except httpx.TimeoutException:
            # If correction times out, return original transcript
            return transcript
        except Exception as e:
            # If correction fails, return original transcript
            return transcript


# Global AI service instance
ai_service = AIService()
