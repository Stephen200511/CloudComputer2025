# ZQ/main.py
import sys
import os
import json
import traceback
import threading
import time
import random
from typing import List, Dict, Optional
from datetime import datetime

from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from neo4j import GraphDatabase, basic_auth
import uvicorn

# Load .env
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

# Add project root to sys.path to allow importing WY
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from WY.agent import CrossAssociationAgent
    from WY.formatter import to_kg
    from WY.providers.openai import openai_llm
    from WY.providers.deepseek import deepseek_llm
except ImportError:
    print("Warning: WY module not found. Agent features will be disabled.")
    CrossAssociationAgent = None
    to_kg = None
    openai_llm = None
    deepseek_llm = None

# Initialize Agent
agent = None
if CrossAssociationAgent:
    llm_func = None
    if os.getenv("OPENAI_API_KEY"):
        llm_func = openai_llm
        print("Using OpenAI LLM")
    elif os.getenv("DEEPSEEK_API_KEY"):
        llm_func = deepseek_llm
        print("Using DeepSeek LLM")
    else:
        print("No API key found for OpenAI or DeepSeek. Agent running in limited mode.")
    
    agent = CrossAssociationAgent(llm=llm_func)

app = FastAPI(title="跨学科知识图谱-后端接口", version="1.0", docs_url="/docs")

bootstrap_lock = threading.Lock()
bootstrap_running = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Neo4j Config
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://neo4j:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "zhangqin123")

driver = None

def try_connect(uri, user, password):
    try:
        drv = GraphDatabase.driver(uri, auth=basic_auth(user, password))
        with drv.session() as session:
            session.run("RETURN 1")
        print(f"Connected to Neo4j at {uri}")
        return drv
    except Exception as e:
        print(f"Failed to connect to Neo4j at {uri}: {e}")
        return None

# Try configured URI first
driver = try_connect(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)

# If failed and URI was default docker one, try localhost
if not driver and NEO4J_URI == "bolt://neo4j:7687":
    print("Retrying with localhost...")
    driver = try_connect("bolt://localhost:7687", NEO4J_USER, NEO4J_PASSWORD)

# Load test data as fallback
test_data = {"nodes": [], "edges": []}
try:
    with open(os.path.join(os.path.dirname(__file__), "test_kg_data.json"), "r", encoding="utf-8") as f:
        test_data = json.load(f)
        print(f"Loaded {len(test_data.get('nodes', []))} nodes from test_kg_data.json for fallback.")
except Exception as e:
    print(f"Failed to load test_kg_data.json: {e}")

if not driver:
    print("Neo4j connection failed. Running in degraded mode with test data.")


def get_seed_concepts() -> List[str]:
    raw = os.getenv("KG_SEED_CONCEPTS", "").strip()
    if raw:
        return [x.strip() for x in raw.split(",") if x.strip()]
    return [
        "集合论",
        "概率论",
        "微积分",
        "线性代数",
        "统计学",
        "牛顿力学",
        "热力学",
        "量子力学",
        "相对论",
        "信息熵",
        "香农定理",
        "算法",
        "数据结构",
        "机器学习",
        "神经网络",
        "优化",
        "博弈论",
        "进化论",
        "社会网络",
    ]


def get_bootstrap_targets() -> tuple[int, int, int]:
    min_nodes = int(os.getenv("KG_BOOTSTRAP_MIN_NODES", "30") or 30)
    min_edges = int(os.getenv("KG_BOOTSTRAP_MIN_EDGES", "20") or 20)
    max_calls = int(os.getenv("KG_BOOTSTRAP_MAX_CALLS", "60") or 60)
    return min_nodes, min_edges, max_calls


def get_db_counts() -> tuple[int, int]:
    if not driver:
        return 0, 0
    with driver.session() as session:
        n = session.run("MATCH (n:Concept) RETURN count(n) as c").single()["c"]
        e = session.run("MATCH ()-[r]->() RETURN count(r) as c").single()["c"]
        return int(n or 0), int(e or 0)


def is_bootstrapped() -> bool:
    if not driver:
        return False
    try:
        min_nodes, min_edges, _ = get_bootstrap_targets()
        nodes_count, edges_count = get_db_counts()
        return bool(nodes_count >= min_nodes and edges_count >= min_edges)
    except Exception:
        return False


def set_bootstrapped(value: str):
    if not driver:
        return
    try:
        with driver.session() as session:
            session.run(
                "MERGE (m:Meta {key: 'bootstrapped'}) SET m.status = $s, m.updated_at = $t",
                s=value,
                t=datetime.utcnow().isoformat(),
            )
    except Exception:
        return


def set_bootstrap_progress(status: str, in_progress: bool):
    if not driver:
        return
    try:
        with driver.session() as session:
            session.run(
                "MERGE (m:Meta {key: 'bootstrap_progress'}) SET m.status = $s, m.in_progress = $p, m.updated_at = $t",
                s=status,
                p=bool(in_progress),
                t=datetime.utcnow().isoformat(),
            )
    except Exception:
        return


def bootstrap_graph():
    global bootstrap_running
    if not driver or not agent:
        return
    with bootstrap_lock:
        if bootstrap_running:
            return
        bootstrap_running = True

    try:
        if is_bootstrapped():
            set_bootstrap_progress("ready", False)
            return

        min_nodes, min_edges, max_calls = get_bootstrap_targets()
        concepts = get_seed_concepts()
        random.shuffle(concepts)
        tried = set()
        ok = 0
        total_calls = 0
        set_bootstrap_progress("starting", True)

        def pick_existing_concept() -> str | None:
            try:
                with driver.session() as session:
                    row = session.run(
                        "MATCH (n:Concept) WHERE n.name IS NOT NULL RETURN n.name as name ORDER BY rand() LIMIT 1"
                    ).single()
                    return row.get("name") if row else None
            except Exception:
                return None

        while total_calls < max_calls:
            nodes_count, edges_count = get_db_counts()
            if nodes_count >= min_nodes and edges_count >= min_edges:
                set_bootstrapped(f"ready_{nodes_count}_{edges_count}")
                set_bootstrap_progress("ready", False)
                return

            c = None
            while concepts and c is None:
                cand = concepts.pop(0)
                if cand not in tried:
                    c = cand
            if c is None:
                c = pick_existing_concept()
                if not c or c in tried:
                    time.sleep(0.5)
                    continue

            tried.add(c)
            try:
                set_bootstrap_progress(f"mining:{c}", True)
                res = agent.run(concept=c)
                kg_obj = KGData(**res)
                insert_knowledge_graph(kg_obj)
                ok += 1
            except Exception:
                traceback.print_exc()
            total_calls += 1
            time.sleep(0.3)

        nodes_count, edges_count = get_db_counts()
        set_bootstrapped(f"partial_{ok}_{nodes_count}_{edges_count}")
        set_bootstrap_progress("partial", False)
    finally:
        with bootstrap_lock:
            bootstrap_running = False


@app.on_event("startup")
def on_startup():
    threading.Thread(target=bootstrap_graph, daemon=True).start()


@app.post("/api/kg/bootstrap/trigger")
async def api_bootstrap_trigger():
    if not driver or not agent:
        return {"ok": False, "reason": "neo4j_or_agent_unavailable"}
    if is_bootstrapped():
        return {"ok": True, "already_ready": True}
    threading.Thread(target=bootstrap_graph, daemon=True).start()
    return {"ok": True, "started": True}

# Data Models
class Node(BaseModel):
    node_id: str
    name: str
    domain: str
    definition: str
    confidence: float

class Edge(BaseModel):
    edge_id: str
    source_node_id: str
    target_node_id: str
    relation_type: str
    relation_desc: str
    confidence: float

class KGData(BaseModel):
    meta: Dict
    nodes: List[Node]
    edges: List[Edge]


class SearchOrIngestBody(BaseModel):
    keyword: str
    auto_ingest: bool = True
    points: int = 10

# Helper functions
def format_neo4j_result_to_standard_json(neo4j_result):
    final_nodes = []
    final_edges = []
    node_id_set = set()
    
    for record in neo4j_result:
        raw_nodes = record.get("nodes", [])
        if raw_nodes:
            for node in raw_nodes:
                node_id = node.get("node_id", "")
                if not node_id: continue
                if node_id not in node_id_set:
                    node_id_set.add(node_id)
                    final_nodes.append({
                        "id": node_id,
                        "name": node.get("name", ""),
                        "label": list(node.labels)[0] if node.labels else "Concept",
                        **dict(node.items())
                    })

        raw_edges = record.get("edges", [])
        if raw_edges:
            for rel in raw_edges:
                final_edges.append({
                    "id": rel.element_id if hasattr(rel, 'element_id') else rel.id, # Adapt for newer neo4j driver
                    "source": rel.start_node.get("node_id"),
                    "target": rel.end_node.get("node_id"),
                    "type": rel.type,
                    **dict(rel.items())
                })
    return final_nodes, final_edges

def insert_knowledge_graph(kg_data: KGData):
    if not driver:
        return {"status": "error", "msg": "Neo4j connection unavailable"}
    try:
        with driver.session() as session:
            valid_nodes = [n for n in kg_data.nodes if 0.6 <= n.confidence <= 1.0]
            valid_edges = [e for e in kg_data.edges if 0.6 <= e.confidence <= 1.0]
            
            for node in valid_nodes:
                session.run("""
                    MERGE (c:Concept {node_id: $node_id})
                    SET c.name = $name, c.domain = $domain, c.definition = $definition, c.confidence = $confidence
                """, node_id=node.node_id, name=node.name, domain=node.domain, definition=node.definition, confidence=node.confidence)
            
            for edge in valid_edges:
                rel_type = (edge.relation_type or "RELATED").replace("`", "``")
                session.run(f"""
                    MATCH (s:Concept {{node_id: $source_id}}), (t:Concept {{node_id: $target_id}})
                    MERGE (s)-[r:`{rel_type}` {{edge_id: $edge_id}}]->(t)
                    SET r.relation_desc = $desc, r.confidence = $confidence
                """, source_id=edge.source_node_id, target_id=edge.target_node_id, 
                edge_id=edge.edge_id, desc=edge.relation_desc, confidence=edge.confidence)
            
            return {"status": "success", "msg": f"Inserted {len(valid_nodes)} nodes, {len(valid_edges)} edges"}
    except Exception as e:
        print(f"Insert failed: {e}")
        return {"status": "error", "msg": str(e)}


def normalize_to_kgdata_dict(payload: Dict) -> Dict:
    meta = payload.get("meta") or {}
    nodes_in = payload.get("nodes") or []
    edges_in = payload.get("edges") or []

    nodes_out = []
    for n in nodes_in:
        node_id = n.get("node_id") or n.get("id")
        if not node_id:
            continue
        nodes_out.append(
            {
                "node_id": node_id,
                "name": n.get("name", ""),
                "domain": n.get("domain", "") or n.get("label", ""),
                "definition": n.get("definition", "") or n.get("desc", ""),
                "confidence": float(n.get("confidence", 0.8) or 0.8),
            }
        )

    edges_out = []
    for e in edges_in:
        source = e.get("source_node_id") or e.get("source")
        target = e.get("target_node_id") or e.get("target")
        if not source or not target:
            continue
        relation_type = e.get("relation_type") or e.get("type") or "RELATED"
        edge_id = e.get("edge_id") or e.get("id") or f"{source}->{target}:{relation_type}"
        edges_out.append(
            {
                "edge_id": edge_id,
                "source_node_id": source,
                "target_node_id": target,
                "relation_type": relation_type,
                "relation_desc": e.get("relation_desc", "") or e.get("desc", ""),
                "confidence": float(e.get("confidence", 0.8) or 0.8),
            }
        )

    return {"meta": meta, "nodes": nodes_out, "edges": edges_out}

# Endpoints
@app.get("/health")
async def health_check():
    return {"status": "ok", "neo4j": "connected" if driver else "disconnected"}

@app.post("/api/kg/insert/from-front")
async def insert_kg_from_front(kg_data: Dict):
    try:
        normalized = normalize_to_kgdata_dict(kg_data)
        standard_kg_data = KGData(**normalized)
        insert_result = insert_knowledge_graph(standard_kg_data)
        return {"code": 200, "msg": "入库成功", "data": insert_result}
    except Exception as e:
        return {"code": 500,"msg": f"入库失败：{str(e)}", "data": None}

@app.get("/api/kg/clear/all")
async def clear_all_data():
    if not driver: return {"status": "error", "msg": "Neo4j unavailable"}
    with driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n")
    return {"status": "success", "msg": "Cleared all data"}

@app.get("/api/kg/query/all")
async def api_query_all():
    if not driver:
         return {"meta": {"type": "全量数据(离线模式)"}, "nodes": test_data.get("nodes", []), "edges": test_data.get("edges", [])}
    try:
        with driver.session() as session:
            count_result = session.run("MATCH (n:Concept) RETURN count(n) as count")
            count = count_result.single()["count"]

            if count == 0 and not is_bootstrapped():
                return {
                    "meta": {"type": "全量数据(初始化中)"},
                    "nodes": test_data.get("nodes", []),
                    "edges": test_data.get("edges", []),
                }

            result = session.run("""
                MATCH (a:Concept)-[r]-(b:Concept)
                WITH collect(DISTINCT a) + collect(DISTINCT b) AS all_nodes, collect(DISTINCT r) AS all_edges
                RETURN all_nodes AS nodes, all_edges AS edges """)
            nodes, edges = format_neo4j_result_to_standard_json(result)
            return {"meta": {"type": "全量数据"}, "nodes": nodes, "edges": edges}
    except Exception as e:
        print(f"Query failed: {e}")
        return {"meta": {"type": "全量数据", "error": str(e)}, "nodes": [], "edges": []}

@app.get("/api/kg/query/filter")
async def api_query_filter(domain: str):
    if not driver: return {"meta": {"error": "Neo4j unavailable"}, "nodes": [], "edges": []}
    with driver.session() as session:
        result = session.run("""
            MATCH (core:Concept {domain: $domain})
            OPTIONAL MATCH (a:Concept {domain: $domain})-[r]-(b:Concept {domain: $domain})
            RETURN collect(DISTINCT core) AS nodes, collect(DISTINCT r) AS edges """, domain=domain)
        nodes, edges = format_neo4j_result_to_standard_json(result)
        return {"meta": {"filter_domain": domain}, "nodes": nodes, "edges": edges}

@app.get("/api/kg/query/node/detail")
def api_query_node_detail(node_name: str):
    if not driver: return {"meta": {"error": "Neo4j unavailable"}, "nodes": [], "edges": []}
    with driver.session() as session:
        result = session.run("""
            MATCH (n:Concept {name: $name})
            OPTIONAL MATCH (n)-[r]-(related:Concept)
            RETURN collect(DISTINCT n) AS nodes, collect(DISTINCT related) + collect(DISTINCT n) AS all_nodes, collect(DISTINCT r) AS edges
        """, name=node_name)
        nodes, edges = format_neo4j_result_to_standard_json(result)
        node_detail = nodes[0] if nodes else {}
        return {"meta": {"node_name": node_name}, "node_detail": node_detail, "nodes": nodes, "edges": edges}

from urllib.parse import parse_qs

@app.get("/api/kg/query/domain/multi")
def api_query_multi_domain(request: Request):
    if not driver: return {"meta": {"error": "Neo4j unavailable"}, "nodes": [], "edges": []}
    try:
        query_string = str(request.url.query)
        parsed_qs = parse_qs(query_string)
        raw_domains = parsed_qs.get('domains', [])
        valid_domains = list(set([d.strip() for d in raw_domains if d.strip()]))
        
        if not valid_domains:
            return {"meta": {"domains": []}, "nodes": [], "edges": [],  "msg": "请选择有效领域"}
        
        with driver.session() as session:
            result = session.run("""
                MATCH (n:Concept)
                WHERE n.domain IN $domains
                OPTIONAL MATCH (n)-[r]-(related:Concept) WHERE related.domain IN $domains
                RETURN collect(DISTINCT n) AS nodes, collect(DISTINCT r) AS edges
            """, domains=valid_domains)
            nodes, edges = format_neo4j_result_to_standard_json(result)
            return {
                "meta": {"domains": valid_domains, "node_count": len(nodes), "edge_count": len(edges)},
                "nodes": nodes or [],
                "edges": edges or []
            }
    except Exception as e:
        return {"meta": {"domains": []},"nodes": [],"edges": [],"code": 500,"msg": f"多领域筛选失败：{str(e)}"}

@app.get("/api/kg/query/node/search")
async def api_query_node_search(keyword: str):
    if not driver:
        # Simple local search on test_data
        keyword_lower = keyword.lower()
        matched_nodes = [
            n for n in test_data.get("nodes", []) 
            if keyword_lower in n.get("name", "").lower() or keyword_lower in n.get("definition", "").lower()
        ]
        matched_ids = set(n["node_id"] for n in matched_nodes)
        
        # Find related edges
        related_edges = [
            e for e in test_data.get("edges", [])
            if e["source_node_id"] in matched_ids or e["target_node_id"] in matched_ids
        ]
        
        # Find related nodes from edges
        related_node_ids = set()
        for e in related_edges:
            related_node_ids.add(e["source_node_id"])
            related_node_ids.add(e["target_node_id"])
            
        all_related_nodes = [n for n in test_data.get("nodes", []) if n["node_id"] in related_node_ids]
        
        return {"meta": {"keyword": keyword, "mode": "offline"}, "nodes": all_related_nodes, "edges": related_edges}

    with driver.session() as session:
        result = session.run("""
            MATCH (n:Concept)
            WHERE toLower(n.name) CONTAINS toLower($keyword) OR toLower(n.definition) CONTAINS toLower($keyword)
            OPTIONAL MATCH (n)-[r]-(related:Concept)
            RETURN collect(DISTINCT n) AS nodes, collect(DISTINCT r) AS edges
        """, keyword=keyword)
        nodes, edges = format_neo4j_result_to_standard_json(result)
        return {"meta": {"keyword": keyword}, "nodes": nodes, "edges": edges}


@app.post("/api/kg/query/node/search_or_ingest")
async def api_search_or_ingest(body: SearchOrIngestBody):
    keyword = (body.keyword or "").strip()
    if not keyword:
        return {"meta": {"keyword": "", "error": "empty keyword"}, "nodes": [], "edges": []}

    if not driver:
        return await api_query_node_search(keyword)

    def do_search(k: str):
        with driver.session() as session:
            result = session.run(
                """
                MATCH (n:Concept)
                WHERE toLower(n.name) CONTAINS toLower($keyword) OR toLower(n.definition) CONTAINS toLower($keyword)
                OPTIONAL MATCH (n)-[r]-(related:Concept)
                RETURN collect(DISTINCT n) AS nodes, collect(DISTINCT r) AS edges
                """,
                keyword=k,
            )
            return format_neo4j_result_to_standard_json(result)

    nodes, edges = do_search(keyword)
    if nodes:
        return {"meta": {"keyword": keyword, "ingested": False}, "nodes": nodes, "edges": edges}

    if not body.auto_ingest or not agent:
        return {"meta": {"keyword": keyword, "ingested": False}, "nodes": [], "edges": []}

    try:
        print(f"Agent generating for: {keyword}")
        generated = agent.run(concept=keyword)
        try:
            kg_obj = KGData(**generated)
            insert_knowledge_graph(kg_obj)
        except Exception as e:
            print(f"Auto-ingest failed: {e}")
        nodes2, edges2 = do_search(keyword)
        if nodes2:
            return {"meta": {"keyword": keyword, "ingested": True}, "nodes": nodes2, "edges": edges2}
        return {"meta": {"keyword": keyword, "ingested": True, "mode": "generated"}, **generated}
    except Exception as e:
        traceback.print_exc()
        return {"meta": {"keyword": keyword, "error": str(e)}, "nodes": [], "edges": []}


@app.get("/api/kg/bootstrap/status")
async def api_bootstrap_status():
    min_nodes, min_edges, max_calls = get_bootstrap_targets()
    nodes_count, edges_count = get_db_counts() if driver else (0, 0)
    ready = bool(nodes_count >= min_nodes and edges_count >= min_edges)

    progress = {"status": "unknown", "in_progress": False}
    if driver:
        try:
            with driver.session() as session:
                row = session.run(
                    "MATCH (m:Meta {key: 'bootstrap_progress'}) RETURN m.status as s, m.in_progress as p, m.updated_at as t LIMIT 1"
                ).single()
                if row:
                    progress = {
                        "status": row.get("s") or "unknown",
                        "in_progress": bool(row.get("p")),
                        "updated_at": row.get("t"),
                    }
        except Exception:
            pass

    boot = {"done": ready, "status": None}
    if driver:
        try:
            with driver.session() as session:
                row = session.run(
                    "MATCH (m:Meta {key: 'bootstrapped'}) RETURN m.status as s, m.updated_at as t LIMIT 1"
                ).single()
                if row:
                    boot = {"done": ready, "status": row.get("s"), "updated_at": row.get("t")}
        except Exception:
            pass

    return {
        "ready": ready,
        "counts": {"nodes": nodes_count, "edges": edges_count},
        "target": {"min_nodes": min_nodes, "min_edges": min_edges, "max_calls": max_calls},
        "progress": progress,
        "bootstrapped": boot,
    }

@app.post("/api/agent/generate_ingest")
async def agent_generate_ingest(keyword: str = Query(...), points: int = Query(10)):
    if not agent:
        return {"error": "Agent not initialized"}
    try:
        print(f"Agent generating for: {keyword}")
        res = agent.run(concept=keyword)
        
        # Insert into Neo4j
        try:
            kg_obj = KGData(**res)
            insert_knowledge_graph(kg_obj)
        except Exception as e:
            print(f"Auto-ingest failed: {e}")
            
        return res
    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=False)
