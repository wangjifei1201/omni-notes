#!/usr/bin/env python3
"""
Whisper 流式转录脚本 - 模拟流式效果，实时更新进度
"""
import sys
import json
import os
import time
import threading
import whisper
import torch
import warnings
warnings.filterwarnings("ignore")

def format_time(seconds):
    """格式化时间为 MM:SS"""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins:02d}:{secs:02d}"

class ProgressPrinter:
    """进度打印器 - 在后台线程中模拟实时进度"""
    def __init__(self, duration):
        self.duration = duration
        self.current = 0
        self.running = True
        self.segments = []
        
    def start(self):
        """启动进度线程"""
        self.thread = threading.Thread(target=self._print_progress)
        self.thread.start()
        
    def _print_progress(self):
        """打印进度"""
        import time
        while self.running and self.current < 100:
            time.sleep(0.5)  # 每0.5秒更新一次
            self.current = min(self.current + 2, 95)  # 最多到95%，等真正完成再到100
            print(f"[PROGRESS] {self.current}%", flush=True)
            sys.stdout.flush()
    
    def set_segments(self, segments):
        """设置真实的 segments"""
        self.segments = segments
        self.running = False
        if self.thread:
            self.thread.join(timeout=1)
        
        # 输出真实的 segments
        for i, seg in enumerate(segments):
            progress = int((i + 1) / len(segments) * 100)
            text = seg.get("text", "").strip()
            start = seg.get("start", 0)
            end = seg.get("end", 0)
            
            print(f"[PROGRESS] {progress}%", flush=True)
            if text:
                print(f"[TEXT] {text}", flush=True)
            print(f"[TIME] {format_time(start)} --> {format_time(end)}", flush=True)
            sys.stdout.flush()

def transcribe_stream(audio_path, model_name="base", output_dir="./data", language="Chinese"):
    """流式转录音频"""
    
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
    print(f"[STATUS] 音频时长: {duration:.2f}秒", flush=True)
    print("[STATUS] 开始识别...", flush=True)
    print("[PROGRESS] 0%", flush=True)
    
    # 启动进度线程
    progress_printer = ProgressPrinter(duration)
    progress_printer.start()
    
    try:
        # 执行转录
        result = model.transcribe(
            audio_path,
            language=language,
            task="transcribe",
            fp16=False,
            verbose=False
        )
        
        # 获取结果
        segments = result.get("segments", [])
        if not segments and result.get("text"):
            # 如果没有 segments，创建一个
            segments = [{
                "id": 0,
                "start": 0,
                "end": duration,
                "text": result["text"].strip()
            }]
        
        # 停止进度线程并输出真实结果
        progress_printer.set_segments(segments)
        
    except Exception as e:
        progress_printer.running = False
        raise e
    
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
        transcribe_stream(audio_path, model_name, output_dir, language)
    except Exception as e:
        import traceback
        print(f"[ERROR] {str(e)}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
