from typing import List, Dict, Any

def to_kg(concept: str, associations: List[Dict[str, Any]], no_assoc: List[Dict[str, Any]]) -> Dict[str, Any]:
    nodes = []
    edges = []
    
    # Add root node
    nodes.append({
        "node_id": concept,
        "name": concept,
        "domain": "",
        "definition": "",
        "confidence": 1.0
    })
    
    evidences_map = {}
    
    for assoc in associations:
        target = assoc["target_concept"]
        
        # Add target node
        nodes.append({
            "node_id": target,
            "name": target,
            "domain": assoc.get("discipline", ""),
            "definition": assoc.get("explanation", ""),
            "confidence": assoc.get("confidence", 0.8)
        })
        
        # Add edge
        edge_id = f"{concept}->{target}:{assoc.get('relation_type', 'related')}"
        edges.append({
            "edge_id": edge_id,
            "source_node_id": concept,
            "target_node_id": target,
            "relation_type": assoc.get("relation_type", "related"),
            "relation_desc": assoc.get("explanation", ""),
            "confidence": assoc.get("confidence", 0.8)
        })
        
        # Map evidence
        if "evidence" in assoc:
            evidences_map[edge_id] = assoc["evidence"]
            
    return {
        "meta": {
            "concept": concept,
            "evidence": evidences_map,
            "no_association": no_assoc
        },
        "nodes": nodes,
        "edges": edges
    }
