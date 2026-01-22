# 使用 Node.js 官方镜像
FROM node:18-alpine

RUN apk add --no-cache wget tzdata \
    && ln -snf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo Asia/Shanghai > /etc/timezone

# 设置工作目录
WORKDIR /app

# 复制 package.json 和相关文件
COPY package*.json ./

# 配置国内npm源 + 安装生产依赖（移除重复的npm install）
RUN npm config set registry https://registry.npmmirror.com/ \
    && npm install --production

COPY . ./

# 暴露端口
EXPOSE 3000

# 健康检查（保持你的原始配置，仅优化格式）
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1

# 启动命令
CMD ["node", "server.js"]