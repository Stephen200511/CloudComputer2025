# Dockerfile
# 使用 Node.js 官方镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和相关文件
COPY package*.json ./
COPY server.js ./
COPY *.html ./
COPY *.js ./
COPY *.css ./

# 安装依赖
RUN npm install

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1

# 启动命令
CMD ["node", "server.js"]