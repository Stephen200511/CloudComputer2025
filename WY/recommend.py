def recommend_basics(concept: str) -> list[str]:
    # Simple fallback recommendation logic
    # In production, this could query a knowledge graph or word embedding model
    defaults = ["定义", "上位概念", "常见应用"]
    return defaults
