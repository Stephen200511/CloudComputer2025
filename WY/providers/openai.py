import os
from typing import Callable, Dict, Any

def openai_llm(prompt: str) -> Dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1/chat/completions")
    model = os.getenv("OPENAI_MODEL", "gpt-4o")
    
    if not api_key:
        print("Warning: OPENAI_API_KEY not found.")
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
        
        response = requests.post(base_url, headers=headers, json=data, timeout=30)
        if response.status_code == 200:
            content = response.json()["choices"][0]["message"]["content"]
            import json
            return json.loads(content)
        else:
            print(f"OpenAI API Error: {response.text}")
            return {}
    except Exception as e:
        print(f"OpenAI Call Failed: {e}")
        return {}
