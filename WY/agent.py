from typing import Callable, Dict, Any
from .prompt_templates import cross_domain_prompt, verification_prompt, KNOWN, ALIASES
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

    def verify_evidence(self, claim: str, evidence_list: list) -> list:
        if not self.llm or not evidence_list:
            return evidence_list  # No LLM, return raw hits
        
        verified = []
        for ev in evidence_list:
            # Skip if no summary
            if not ev.get("summary"):
                verified.append(ev)
                continue
                
            prompt = verification_prompt(claim, ev.get("title", ""), ev.get("summary", ""))
            try:
                res = self.llm(prompt)
                if res and res.get("support") is True:
                    ev["verification_reason"] = res.get("reason", "Verified by LLM")
                    verified.append(ev)
                else:
                    # Optional: keep but mark as low relevance? For now, we filter strictly.
                    # Or we can just log it. Let's keep strict filtering for "Smart" behavior.
                    print(f"Evidence rejected: {ev.get('title')} - {res.get('reason')}")
            except Exception as e:
                print(f"Verification failed: {e}")
                verified.append(ev) # Fallback keep
                
        return verified

    def validate_association(self, concept: str, assoc: Dict[str, Any]) -> float:
        # Base confidence from source (KNOWN items have evidence, LLM items might)
        has_prior_evidence = len(assoc.get("evidence", [])) > 0
        confidence = 0.8 if has_prior_evidence else 0.5

        target = assoc["target_concept"]
        relation = assoc.get("relation_type", "related")
        claim = f"{concept} is {relation} to {target}"
        
        # 1. Search Candidates
        a_terms = ALIASES.get(concept, [concept])
        b_terms = ALIASES.get(target, [target])
        hits = self.arxiv.search(a_terms + b_terms, max_results=5)
        
        if not hits:
            hits = self.cnki.validate_pair(a_terms[0], b_terms[0])
            
        if not hits:
            # If search fails (e.g. network error) or no results, retain base confidence
            return confidence
            
        # 2. Verify Candidates (The "Smart" Part)
        valid_evidence = self.verify_evidence(claim, hits)
        
        if not valid_evidence:
            return 0.1 # Found hits but none verified -> very low confidence
            
        assoc["evidence"] = assoc.get("evidence", []) + valid_evidence[:3]
        
        # Score based on verified evidence count
        return min(1.0, confidence + 0.15 * len(valid_evidence))

    def run(self, concept: str) -> Dict[str, Any]:
        gen = self.generate(concept)
        assoc = []
        for a in gen.get("associations", []):
            conf = self.validate_association(concept, a)
            if conf > 0.2: # Threshold
                a["confidence"] = conf
                assoc.append(a)
        no_assoc = gen.get("no_association", [])
        if not assoc and not no_assoc:
            no_assoc = [{"discipline": "综合", "message": "暂无关联", "suggestions": recommend_basics(concept)}]
        return to_kg(concept, assoc, no_assoc)
