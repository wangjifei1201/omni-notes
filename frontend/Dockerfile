# Frontend Dockerfile
FROM node:20-alpine

WORKDIR /app

# 复制 package 文件
COPY package*.json ./
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 构建
RUN npm run build

# 暴露端口
EXPOSE 3000

# 启动
CMD ["npm", "start"]
