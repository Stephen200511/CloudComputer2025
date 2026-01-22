# 跨学科知识图谱系统部署指南

本指南将指导你如何将本项目（包含前端可视化、后端 API、图数据库和智能体）部署到互联网上，让所有人都能访问。

## 1. 准备工作：服务器选型

由于本项目包含四个服务（前端、后端、Neo4j 数据库、Python Agent），推荐使用**云服务器 (VPS)**。

### 推荐配置
-   **CPU**: 2核 或以上
-   **内存**: 4GB 或以上（Neo4j 和 Python Agent 较吃内存）
-   **硬盘**: 40GB SSD
-   **操作系统**: Ubuntu 22.04 LTS (推荐) 或 Debian 11

### 推荐服务商
-   **国内**: 阿里云、腾讯云、华为云（需备案域名）
-   **海外**: AWS, DigitalOcean, Vultr, Linode（无需备案，即买即用）

---

## 2. 环境安装

登录到你的服务器后，执行以下命令安装 Docker 和 Docker Compose。

```bash
# 1. 更新系统
sudo apt update && sudo apt upgrade -y

# 2. 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 3. 验证安装
sudo docker --version
sudo docker compose version
```

---

## 3. 代码上传

你需要将本地代码上传到服务器。

### 方法 A：使用 Git (推荐)
如果你的代码在 GitHub/GitLab 上：
```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo
```

### 方法 B：使用 SCP (手动上传)
在本地终端执行：
```bash
# 将当前目录下的所有文件上传到服务器的 /root/cc_p2 目录
scp -r . root@你的服务器IP:/root/cc_p2
```

---

## 4. 配置密钥

在服务器项目根目录下创建 `.env` 文件，填入你的 DeepSeek 密钥。

```bash
nano .env
```

**粘贴以下内容（替换为你的真实密钥）：**
```ini
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1/chat/completions
DEEPSEEK_MODEL=deepseek-chat
```
按 `Ctrl+O` 保存，`Ctrl+X` 退出。

---

## 5. 启动服务

在项目根目录下执行：

```bash
# 构建并后台启动所有服务
sudo docker compose up -d --build
```

### 验证状态
```bash
sudo docker compose ps
```
你应该能看到 `kg_frontend`, `kg_backend`, `kg_neo4j`, `kg_agent` 四个容器都处于 `Up` 状态。

---

## 6. 域名与外网访问

### 方式 A：直接通过 IP 访问
-   **前端**: `http://你的服务器IP:8080`
-   **后端**: `http://你的服务器IP:8001`
-   **Neo4j**: `http://你的服务器IP:7474`

*注意：请确保云服务商的安全组（防火墙）放行了 8080, 8001, 7474, 7687 端口。*

### 方式 B：配置 Nginx 反向代理 (推荐，使用域名)
如果你有域名（如 `kg.example.com`），可以配置 Nginx 将 80 端口转发到 8080。

1.  安装 Nginx: `sudo apt install nginx`
2.  编辑配置: `sudo nano /etc/nginx/sites-available/kg`
    ```nginx
    server {
        listen 80;
        server_name kg.example.com;

        location / {
            proxy_pass http://localhost:8080;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
        
        # 转发后端 API
        location /api/ {
            proxy_pass http://localhost:8001;
        }
    }
    ```
3.  启用配置: `sudo ln -s /etc/nginx/sites-available/kg /etc/nginx/sites-enabled/`
4.  重启 Nginx: `sudo systemctl restart nginx`

---

## 7. 常用维护命令

-   **查看日志**: `sudo docker compose logs -f`
-   **重启服务**: `sudo docker compose restart`
-   **停止服务**: `sudo docker compose down`
-   **手动触发 Agent 生成**:
    ```bash
    sudo docker compose exec agent python -m WY.cli 熵
    ```
