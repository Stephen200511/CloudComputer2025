#!/bin/bash
# deploy.sh

# 构建并启动容器
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# 等待服务启动
echo "等待服务启动..."
sleep 10

# 检查服务状态
docker-compose ps

# 显示日志
echo "显示服务日志:"
docker-compose logs --tail=20 frontend