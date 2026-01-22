# 使用官方 Python 运行时作为父镜像
FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 复制依赖文件并安装
# 注意：这里假设你在项目根目录构建，并把整个上下文传进来
# 或者你可以只复制 requirements.txt 如果你有的话
COPY . .

# 安装依赖
RUN pip install --no-cache-dir requests

# 声明容器运行时监听的端口（虽然CLI应用通常不需要，但为了规范）
# EXPOSE 8000

# 运行命令（默认行为，可被 docker-compose 覆盖）
CMD ["python", "-m", "WY.cli", "熵"]
