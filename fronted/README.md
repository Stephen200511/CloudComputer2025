# 跨学科知识图谱前端模块

## 功能说明

1. 核心功能：概念输入、跨学科图谱可视化、节点拖拽/缩放/筛选、图谱导出（PNG/PDF）
2. 交互功能：hover 显示关联依据、点击查看概念详情、重置布局
3. 适配功能：节点过多时自动优化布局、无数据提示、加载状态反馈

## 技术栈

- 可视化：D3.js
- 网络请求：axios
- 导出工具：html2canvas + jspdf
- 容器化：Docker + Nginx

## 本地开发环境

1. 安装 Node.js（v14+）
2. 进入 frontend 目录，安装依赖：`npm install`
3. 启动本地服务：右键 public/index.html → Open with Live Server
4. 访问地址：http://127.0.0.1:5500/public/index.html

## 容器化部署

1. 确保已安装 Docker 和 Docker Compose
2. 项目根目录执行：`docker-compose up -d`
3. 访问前端：http://localhost（默认 80 端口）

## 接口对接说明

- 后端接口地址：/api/kg/query
- 请求参数：keyword（核心概念）、subject（学科筛选）
- 返回数据格式：
  {
  "nodes": [{id, name, subject, desc}],
  "links": [{source, target, type, basis}],
  "recommend": [推荐概念]
  }
