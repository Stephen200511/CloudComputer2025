# 基础镜像
FROM python:3.9-slim

RUN rm -rf /etc/apt/sources.list.d/* \
    && echo "deb http://mirrors.tuna.tsinghua.edu.cn/debian/ trixie main contrib non-free non-free-firmware" > /etc/apt/sources.list \
    && echo "deb http://mirrors.tuna.tsinghua.edu.cn/debian/ trixie-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list \
    && echo "deb http://mirrors.tuna.tsinghua.edu.cn/debian-security/ trixie-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list \
    && apt update -o Acquire::Retries=3 \
    && apt install -y --no-install-recommends \
        gcc \
        libssl-dev \
        libffi-dev \
    && apt autoremove -y \
    && apt clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# 设置工作目录
WORKDIR /app

# 复制requirements.txt（利用Docker缓存）
COPY requirements.txt .

# 升级pip+安装依赖
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    -i https://pypi.tuna.tsinghua.edu.cn/simple \
    --extra-index-url https://mirrors.aliyun.com/pypi/simple/ \
    --trusted-host pypi.tuna.tsinghua.edu.cn \
    --trusted-host mirrors.aliyun.com \
    --trusted-host pypi.org \
    --trusted-host files.pythonhosted.org

# 复制main.py到容器
COPY main.py .

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]