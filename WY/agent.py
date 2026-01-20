from typing import Callable, Dict, Any
from .prompt_templates import cross_domain_prompt, KNOWN, ALIASES
from .validators import ArxivValidator, CnkiValidator
from .formatter import to_kg
from .recommend import recommend_basics

def default_generator(concept: str) -> Dict[str, Any]:
    items = KNOWN.get(concept, [])
    if not items:
        return {"concept": concept, "associations": [], "no_association": [{"discipline": "综合", "message": "暂无关联", "suggestions": recommend_basics(concept)}]}
    return {"concept": concept, "associations": items, "no_association": []}

class CrossAssociationAgent:
    def __init__(self, llm: Callable[[str], Dict[str, Any]] = None, disciplines: list | None = None):
        self.llm = llm
        self.arxiv = ArxivValidator()
        self.cnki = CnkiValidator()
        self.disciplines = disciplines

    def generate(self, concept: str) -> Dict[str, Any]:
        prompt = cross_domain_prompt(concept, self.disciplines)
        if self.llm:
            try:
                res = self.llm(prompt)
                if res:
                    return res
            except Exception as e:
                print(f"LLM generation failed, falling back to default: {e}")
        return default_generator(concept)

    def validate_association(self, concept: str, assoc: Dict[str, Any]) -> float:
        a_terms = ALIASES.get(concept, [concept])
        b_terms = ALIASES.get(assoc["target_concept"], [assoc["target_concept"]])
        hits = self.arxiv.search(a_terms + b_terms, max_results=10)
        if not hits:
            hits = self.cnki.validate_pair(a_terms[0], b_terms[0])
        if not hits:
            return 0.0
        assoc["evidence"] = assoc.get("evidence", []) + hits[:2]
        return min(1.0, 0.6 + 0.1 * len(hits))

    def run(self, concept: str) -> Dict[str, Any]:
        gen = self.generate(concept)
        assoc = []
        for a in gen.get("associations", []):
            conf = self.validate_association(concept, a)
            if conf > 0:
                a["confidence"] = conf
                assoc.append(a)
        no_assoc = gen.get("no_association", [])
        if not assoc and not no_assoc:
            no_assoc = [{"discipline": "综合", "message": "暂无关联", "suggestions": recommend_basics(concept)}]
        return to_kg(concept, assoc, no_assoc)
