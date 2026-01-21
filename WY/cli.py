import json
import sys
import os
import hashlib
from datetime import datetime
from .agent import CrossAssociationAgent
from .providers import get_llm
from fastapi import FastAPI,Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 测试阶段允许所有前端地址
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],  # 显式允许GET/OPTIONS（fetch会先发OPTIONS预检）
    allow_headers=["*"],
    expose_headers=["*"],  # 暴露所有响应头，避免浏览器拦截
)

def load_env():
    env_path = os.path.join(os.getcwd(), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()

def generate_filename(username="user"):
    timestamp = datetime.now().strftime("%Y%m%d%H%M")
    # Generate a random-like hash based on time and username
    raw = f"{timestamp}_{username}"
    hash_val = hashlib.sha256(raw.encode()).hexdigest()
    return f"{timestamp}_{username}_{hash_val}.txt"

load_env()
llm = get_llm()
agent = CrossAssociationAgent(llm=llm, disciplines=None)

def main():
    if len(sys.argv) < 2:
        print("用法: python -m WY.cli 概念")
        return
    concept = sys.argv[1]
    res = agent.run(concept)
    output_content = json.dumps(res, ensure_ascii=False, indent=2)
    filename = generate_filename()
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(output_content)
        
    print(filename)

@app.get("/api/kg/query/node/search")
async def search_node(
    keyword: str = Query(..., description="前端传入的核心概念，对应concept")):
    # 核心映射：前端 keyword → AI 侧 concept
    result = agent.run(concept=keyword)
    output_content = json.dumps(result, ensure_ascii=False, indent=2)
    # print(output_content)
    # 直接返回 AI 生成的结构化结果给前端
    return output_content

if __name__ == "__main__":
    import uvicorn
    # 无额外参数时启动服务
    if len(sys.argv) == 1:
        # 启动服务，允许前端访问（host=0.0.0.0），端口 8000
        uvicorn.run(app, host="0.0.0.0", port=8000)
    # 其他情况  python -m WY.cli 概念
    else:
        main()
