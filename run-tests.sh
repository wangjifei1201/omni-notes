#!/bin/bash

echo "================================"
echo "Omni-Notes 自动化测试"
echo "================================"
echo ""

# 确保服务器在运行
echo "检查服务器状态..."
if ! curl -s http://localhost:5001/api/health > /dev/null; then
    echo "⚠️  服务器未运行，正在启动..."
    nohup node server.js > server.log 2>&1 &
    sleep 3
fi

# 运行测试
echo ""
echo "运行分组功能测试..."
npx playwright test tests/group.spec.js --headed

echo ""
echo "================================"
echo "测试完成"
echo "================================"
