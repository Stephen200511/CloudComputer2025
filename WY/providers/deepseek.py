import os
from typing import Callable, Dict, Any

def deepseek_llm(prompt: str) -> Dict[str, Any]:
    api_key = os.getenv("DEEPSEEK_API_KEY")
    base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1/chat/completions")
    model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
    
    if not api_key:
        print("Warning: DEEPSEEK_API_KEY not found.")
        return {}

    try:
        import requests
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"}
        }
        
        print(f"DeepSeek request -> model={model} url={base_url}")
        response = requests.post(base_url, headers=headers, json=data, timeout=30)
        if response.status_code == 200:
            content = response.json()["choices"][0]["message"]["content"]
            import json
            return json.loads(content)
        else:
            print(f"DeepSeek API Error: {response.text}")
            return {}
    except Exception as e:
        print(f"DeepSeek Call Failed: {e}")
        return {}
