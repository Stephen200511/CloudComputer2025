import os
from typing import Callable, Dict, Any
from .deepseek import deepseek_llm
from .openai import openai_llm

def get_llm() -> Callable[[str], Dict[str, Any]] | None:
    provider = os.getenv("LLM_PROVIDER", "").lower()
    
    if provider == "deepseek":
        return deepseek_llm
    elif provider == "openai":
        return openai_llm
    
    return None
