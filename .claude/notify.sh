#!/bin/bash
# notify.sh - 任务完成提示脚本

# 播放系统提示音（macOS）
afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || \
afplay /System/Library/Sounds/Tink.aiff 2>/dev/null || \
echo -e "\a"

# 可选：显示通知
osascript -e 'display notification "Claude 已完成任务" with title "Claude Code"' 2>/dev/null || true

echo "✅ 任务完成！请查看结果..."
