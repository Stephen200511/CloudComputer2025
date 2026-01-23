# 跨学科知识图谱智能体（CloudComputer2025 期末项目）

本项目实现了一个“跨学科知识图谱智能体”系统：
- 首页自动通过 **AI Agent** 预置（挖掘）一批常见概念与跨学科关联，写入 **Neo4j**；
- 用户搜索概念时：**先查图数据库**，若不存在则自动触发 **AI 挖掘 → 入库 → 返回结果**；
- 前端基于 **ECharts** 展示可交互图谱，支持筛选、随机探索、节点详情、导出等。

## 分工说明

- **张秦 (10235501408)** - **后端架构与数据层 (40%)**
  - 负责模块：[ZQ/main.py](ZQ/main.py) 及后端核心逻辑
  - 主要贡献：后端 FastAPI 架构搭建、Neo4j 图数据库集成与驱动封装、Bootstrap 自动播种机制、搜索闭环逻辑（查库-挖掘-入库）、Docker 容器化编排。

- **王玉 (10235501443)** - **智能体与 Prompt 工程 (35%)**
  - 负责模块：[WY/agent.py](WY/agent.py) 及 LLM 交互
  - 主要贡献：Cross-disciplinary Agent 设计、Prompt 工程调优（结构化 JSON 输出）、多 LLM Provider 适配（OpenAI/DeepSeek）、学术证据链生成与校验逻辑。

- **李东旭 (10235501412)** - **前端交互与可视化 (25%)**
  - 负责模块：[LDX/app.js](LDX/app.js) 及界面设计
  - 主要贡献：基于 ECharts 的知识图谱渲染、动态交互逻辑（筛选、高亮、详情侧边栏）、Bootstrap 进度轮询与状态反馈、响应式 UI 设计。

## 目录结构

- `ZQ/`：后端 API（FastAPI）+ Neo4j 读写 + 启动播种（bootstrap）
- `WY/`：跨学科关联挖掘 Agent（Prompt + LLM Provider + 证据校验）
- `LDX/`：前端可视化（ECharts）
- `docker-compose.yml`：一键编排（Neo4j + 后端 + Agent + 前端）

## 系统架构与数据流

1. **前端（LDX）**
   - 首次加载：请求 `GET /api/kg/query/all` 获取全量图谱并渲染
   - 初始化阶段：轮询 `GET /api/kg/bootstrap/status` 显示进度，未就绪时自动触发 `POST /api/kg/bootstrap/trigger`
   - 搜索：调用 `POST /api/kg/query/node/search_or_ingest`

2. **后端（ZQ）**
   - 提供图谱查询、筛选、节点详情、入库等接口
   - 启动时后台线程执行 bootstrap：持续调用 Agent 挖掘一批概念，直到图谱达到可探索阈值
   - 搜索接口实现“查库→挖掘→入库→再查库”的闭环

3. **图数据库（Neo4j）**
   - 存储 `Concept` 节点与关系边（关系类型支持中文）

4. **智能体（WY）**
   - 根据概念与学科视角生成关联概念、关系类型、解释与证据
   - 支持 OpenAI / DeepSeek 两种 Provider（按环境变量自动选择）

## 快速开始（本地开发）

### 方式 A：本地直接跑（Windows / macOS / Linux）

1) 启动 Neo4j（推荐用 Docker）

```bash
docker run --name neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/zhangqin123 neo4j:5.15.0
```

2) 启动后端（ZQ）

```bash
cd ZQ
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

3) 启动前端（LDX）

```bash
cd LDX
npm install
npm start
```

访问：`http://localhost:3000/`

### 方式 B：Docker Compose 一键启动（推荐）

在项目根目录：

```bash
docker compose up -d --build
```

服务默认端口：
- 前端：`http://localhost:8080/`
- 后端：`http://localhost:8001/docs`
- Neo4j：`http://localhost:7474/`（账号：`neo4j`，密码：`zhangqin123`）

## 环境变量（.env）

项目根目录支持 `.env`（后端会读取），常用项：

```ini
# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=zhangqin123

# LLM Provider（二选一）
DEEPSEEK_API_KEY=sk-xxxxx
# OPENAI_API_KEY=sk-xxxxx

# 启动播种策略（可选）
KG_SEED_CONCEPTS=集合论,概率论,线性代数,牛顿力学,热力学,量子力学,算法,数据结构,机器学习,神经网络
KG_BOOTSTRAP_MIN_NODES=30
KG_BOOTSTRAP_MIN_EDGES=20
KG_BOOTSTRAP_MAX_CALLS=60
```

## 主要接口（ZQ 后端）

- `GET /health`：健康检查
- `GET /api/kg/query/all`：全量图谱
- `POST /api/kg/query/node/search_or_ingest`：搜索（命中则返回；未命中则挖掘并入库后返回）
- `GET /api/kg/query/node/detail?node_name=...`：节点详情
- `GET /api/kg/query/domain/multi?domains=数学&domains=物理`：多学科筛选
- `GET /api/kg/bootstrap/status`：初始化/播种状态
- `POST /api/kg/bootstrap/trigger`：手动触发初始化挖掘

## 使用说明（UI）

- 首页加载时会显示初始化进度；在图谱未就绪前，“随机探索”按钮会被禁用
- 搜索框输入概念点击“搜索”：先查库，库中不存在则自动挖掘并入库
- 点击节点/连线可查看详情；左侧可按学科筛选

## 部署

见 [DEPLOY.md](DEPLOY.md)。
