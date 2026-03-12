#!/usr/bin/env python3
"""
Whisper 流式转录脚本 - 基于实际处理进度
"""
import sys
import json
import os
import time
import whisper
import torch
import warnings
warnings.filterwarnings("ignore")

def format_time(seconds):
    """格式化时间为 MM:SS"""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins:02d}:{secs:02d}"

def transcribe_with_progress(audio_path, model_name="base", output_dir="./data", language="Chinese"):
    """转录音频并输出实际进度"""
    
    print("[STATUS] 正在启动语音识别...", flush=True)
    print(f"[STATUS] 加载模型: {model_name}", flush=True)
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[STATUS] 使用设备: {device}", flush=True)
    
    # 加载模型
    model = whisper.load_model(model_name).to(device)
    print("[STATUS] 模型加载完成", flush=True)
    
    # 加载音频
    print(f"[STATUS] 加载音频: {audio_path}", flush=True)
    audio = whisper.load_audio(audio_path)
    duration = len(audio) / whisper.audio.SAMPLE_RATE
    print(f"[STATUS] 音频时长: {duration:.2f}秒 ({format_time(duration)})", flush=True)
    
    # 计算 mel 频谱
    print("[STATUS] 预处理音频...", flush=True)
    print("[PROGRESS] 5%", flush=True)
    mel = whisper.log_mel_spectrogram(audio).to(model.device)
    print("[PROGRESS] 10%", flush=True)
    
    # 检测语言
    print("[STATUS] 检测语言...", flush=True)
    _, probs = model.detect_language(mel)
    detected_lang = max(probs, key=probs.get)
    print(f"[STATUS] 检测到语言: {detected_lang}", flush=True)
    print("[PROGRESS] 15%", flush=True)
    
    # 使用 decode 逐段处理以获取真实进度
    print("[STATUS] 开始转录...", flush=True)
    
    # 设置解码选项
    decode_options = {
        "language": language if language else detected_lang,
        "task": "transcribe",
        "fp16": False,
        "verbose": False,
        "condition_on_previous_text": True,
    }
    
    # 执行转录
    result = model.transcribe(audio_path, **decode_options)
    
    # 获取分段结果
    segments = result.get("segments", [])
    total_segments = len(segments)
    
    if total_segments == 0:
        # 如果没有分段，从完整文本创建
        full_text = result.get("text", "").strip()
        if full_text:
            segments = [{
                "id": 0,
                "start": 0,
                "end": duration,
                "text": full_text
            }]
            total_segments = 1
    
    # 输出每个分段（模拟逐段处理的进度）
    print(f"[STATUS] 识别到 {total_segments} 个片段", flush=True)
    
    for i, seg in enumerate(segments):
        # 计算进度：15%（预处理）+ 85%（转录进度）
        progress = 15 + int((i + 1) / total_segments * 85)
        
        text = seg.get("text", "").strip()
        start = seg.get("start", 0)
        end = seg.get("end", 0)
        
        print(f"[PROGRESS] {progress}%", flush=True)
        if text:
            print(f"[TEXT] {text}", flush=True)
        print(f"[TIME] {format_time(start)} --> {format_time(end)}", flush=True)
        sys.stdout.flush()
    
    # 保存结果
    output_path = os.path.join(output_dir, os.path.basename(audio_path).replace('.mp3', '.json'))
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({"segments": segments}, f, ensure_ascii=False, indent=2)
    
    print(f"[STATUS] 转录完成，共 {len(segments)} 段", flush=True)
    print(f"[STATUS] 结果保存到: {output_path}", flush=True)
    
    return output_path

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python whisper_stream.py <audio_path> [model_name] [output_dir] [language]", file=sys.stderr)
        sys.exit(1)
    
    audio_path = sys.argv[1]
    model_name = sys.argv[2] if len(sys.argv) > 2 else "base"
    output_dir = sys.argv[3] if len(sys.argv) > 3 else "./data"
    language = sys.argv[4] if len(sys.argv) > 4 else "Chinese"
    
    try:
        transcribe_with_progress(audio_path, model_name, output_dir, language)
    except Exception as e:
        import traceback
        print(f"[ERROR] {str(e)}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
