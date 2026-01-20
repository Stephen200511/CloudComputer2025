# WY: 跨学科关联挖掘与智能体策略

## 目标
设计并实现 CrossAssociationAgent，负责从多学科视角挖掘核心概念的关联，通过学术接口校验其合理性，并输出符合图数据库标准的 JSON 数据。

## 核心任务
1.  **Prompt 模板设计**：
    -   动态学科支持（默认：数学、物理、社会学、生物学）
    -   强制结构化输出（JSON）
    -   要求“关联依据”字段（标题、作者、年份、来源）

2.  **校验层 (Validator)**：
    -   **ArXiv**: 实时检索，验证“概念A + 概念B”的共现性。
    -   **CNKI**: 预留开放 API 接口。
    -   **置信度计算**: 基于检索命中数与来源权威性。

3.  **数据格式化**：
    -   **Node**: `node_id`, `name`, `domain`, `definition`, `confidence`
    -   **Edge**: `edge_id`, `source`, `target`, `type`, `desc`, `confidence`
    -   **KGData**: 包含 `meta` (evidence), `nodes`, `edges`

4.  **异常处理**:
    -   无关联时返回 `no_association` 结构，并推荐基础概念。
    -   LLM 服务不可用时回退到内置知识库（KNOWN）。

## 接口契约

### 前端接口 (建议)
-   `GET /api/graph/generate`
    -   参数: `concept` (string), `disciplines` (string, comma-separated)
    -   返回: KGData JSON
-   `GET /api/graph/by-concept`
    -   参数: `concept` (string)
    -   返回: KGData (from DB)
-   `GET /api/graph/evidence`
    -   参数: `edge_id`
    -   返回: Evidence List

### 后端接口 (建议)
-   `POST /api/graph/store`
    -   Body: KGData
    -   作用: 存入 Neo4j
-   `GET /api/graph/query`
    -   参数: `concept`, `discipline`
    -   返回: KGData

## 环境变量配置 (.env)
推荐在项目根目录创建 `.env` 文件（不要提交到 git）：

```ini
# 选择 LLM 提供商: deepseek 或 openai
LLM_PROVIDER=deepseek

# DeepSeek 配置
DEEPSEEK_API_KEY=sk-xxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1/chat/completions
DEEPSEEK_MODEL=deepseek-chat

# OpenAI 配置
OPENAI_API_KEY=sk-xxxxxx
```

## 运行示例

### 1. 配置环境变量
使用 PowerShell 脚本快速生成（仅本地）：
```powershell
./set-env.ps1 -Provider deepseek -ApiKey "your-key"
```

### 2. 运行 CLI
```bash
python -m WY.cli 熵
```
输出：生成 `YYYYMMDDHHMM_user_HASH.txt` 文件，包含完整 JSON 数据。
