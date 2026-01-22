FROM python:3.10-slim

RUN rm -rf /etc/apt/sources.list /etc/apt/sources.list.d/* && \
    echo "deb http://mirrors.tuna.tsinghua.edu.cn/debian/ bullseye main contrib non-free" > /etc/apt/sources.list && \
    echo "deb http://mirrors.tuna.tsinghua.edu.cn/debian-security bullseye-security main contrib non-free" >> /etc/apt/sources.list && \
    # 强制apt只使用我们写的源，禁用所有自动源追加/更新
    echo 'Acquire::Disable-Cleanup "true";' > /etc/apt/apt.conf.d/00-disable-external-sources && \
    echo 'Acquire::Retries "3";' >> /etc/apt/apt.conf.d/00-disable-external-sources && \
    echo 'Acquire::Timeout "10";' >> /etc/apt/apt.conf.d/00-disable-external-sources && \
    echo 'Dir::Etc::sourcelist "/etc/apt/sources.list";' >> /etc/apt/apt.conf.d/00-disable-external-sources && \
    echo 'Dir::Etc::sourceparts "/dev/null";' >> /etc/apt/apt.conf.d/00-disable-external-sources

# 设置时区和编码（提前设置，无交互）
ENV TZ=Asia/Shanghai \
    LANG=C.UTF-8 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

# 立即设置时区，避免后续安装弹窗
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 设置工作目录
WORKDIR /app

# 安装系统依赖（仅curl，换源后10秒内完成）
RUN apt-get update -o Acquire::AllowInsecureRepositories=true && \
    apt-get install -y --no-install-recommends curl && \
    # 彻底清理apt缓存，不留任何残留
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# 复制依赖文件，利用Docker缓存
COPY requirements.txt .

# 安装Python依赖（纯清华源，无任何外部源）
RUN pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple --trusted-host pypi.tuna.tsinghua.edu.cn && \
    pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple --trusted-host pypi.tuna.tsinghua.edu.cn

# 复制项目代码
COPY . .

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["python", "-m", "WY.cli"]