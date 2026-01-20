# 第一步：构建前端项目（基于Node.js环境）
FROM node:16-alpine as build-stage
WORKDIR /app
# 复制依赖配置文件
COPY package*.json ./
# 安装依赖
RUN npm install
# 复制所有前端代码
COPY . .
# 构建前端项目（如果用了Vue/React需要打包，纯JS/HTML可跳过这步，直接复制文件）
# 这里是纯JS/HTML，所以直接复制到构建目录
RUN mkdir -p /app/dist && cp -r public/* /app/dist && cp -r src/* /app/dist

# 第二步：部署（基于Nginx服务器，轻量高效）
FROM nginx:alpine as production-stage
# 从构建阶段复制打包后的文件到Nginx的静态文件目录
COPY --from=build-stage /app/dist /usr/share/nginx/html
# 复制Nginx配置文件（可选，优化Nginx配置）
# 如果你有自定义nginx.conf，可添加：COPY nginx.conf /etc/nginx/conf.d/default.conf
# 暴露80端口（前端默认端口）
EXPOSE 80
# 启动Nginx
CMD ["nginx", "-g", "daemon off;"]