# 环境安装：pip install neo4j fastapi uvicorn pydantic python-multipart
from neo4j import GraphDatabase, basic_auth
from pydantic import BaseModel
from typing import List, Dict, Optional
import json
# Neo4j数据库连接配置
NEO4J_URI = "bolt://neo4j:7687"
# NEO4J_URI = "bolt://localhost:7687"  # Docker部署后改成bolt://neo4j:7687
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "zhangqin123"
driver = GraphDatabase.driver(NEO4J_URI, auth=basic_auth(NEO4J_USER, NEO4J_PASSWORD))

# 定义和算法组一致的标准数据模型（校验用）
class Node(BaseModel):
    node_id: str # 节点id
    name: str   # 概念名称
    domain: str # 学科领域
    definition: str # 概念定义
    confidence: float # 置信度（0-1之间）

class Edge(BaseModel):
    edge_id: str #  边id
    source_node_id: str # 源节点id
    target_node_id: str # 目标节点id
    relation_type: str # 关系类型
    relation_desc: str # 关系描述
    confidence: float # 置信度（0-1之间）

class KGData(BaseModel):
    meta: Dict # 元数据，如生成时间、版本等
    nodes: List[Node] # 节点列表
    edges: List[Edge] # 边列表    

# 核心入库函数：标准JSON → Neo4j节点+边
def insert_knowledge_graph(kg_data: KGData):
    """ 标准JSON数据入库Neo4j """
    with driver.session() as session:
        # 过滤低置信度的节点和边（防幻觉核心校验层），防止过高置信度
        valid_nodes = [n for n in kg_data.nodes if n.confidence >= 0.6 and n.confidence<=1.0]
        valid_edges = [e for e in kg_data.edges if e.confidence >= 0.6 and e.confidence<=1.0]
        
        # 入库节点:MERGE 避免重复，SET更新属性
        for node in valid_nodes:
            session.run("""
                MERGE (c:Concept {node_id: $node_id})
                SET c.name = $name, c.domain = $domain, c.definition = $definition, c.confidence = $confidence
            """, node_id=node.node_id, name=node.name, domain=node.domain, definition=node.definition, confidence=node.confidence)
        
        # 入库边：MATCH找到节点，MERGE创建边，SET更新属性
        for edge in valid_edges:
            session.run(f"""
                MATCH (s:Concept {{node_id: $source_id}}), (t:Concept {{node_id: $target_id}})
                MERGE (s)-[r:{edge.relation_type} {{edge_id: $edge_id}}]->(t)
                SET r.relation_desc = $desc, r.confidence = $confidence
            """, source_id=edge.source_node_id, target_id=edge.target_node_id, 
            edge_id=edge.edge_id, desc=edge.relation_desc, confidence=edge.confidence)

        return {"status": "success", "msg": f"入库节点{len(valid_nodes)}个，边{len(valid_edges)}条"}

# 本地开发测试函数：读取本地JSON文件，调用入库
def local_test_insert():
    # 读取本地JSON测试文件
    with open("test_kg_data.json", "r", encoding="utf-8") as f:
        json_data = json.load(f)
    # 转换成校验模型
    kg_data = KGData(**json_data)
    # 调用入库
    result = insert_knowledge_graph(kg_data)
    print("本地入库测试结果：", result)
    return result

# 辅助函数：Neo4j查询结果转换成标准JSON格式
def format_neo4j_result_to_standard_json(neo4j_result):
    final_nodes = []  # 最终返回的节点数组
    final_edges = []  # 最终返回的边数组
    node_id_set = set()  # 去重节点，避免同一个节点重复添加
    # 遍历Neo4j的查询结果
    for record in neo4j_result:
        # 处理Neo4j原生Node对象
        raw_nodes = record.get("nodes", [])
        for node in raw_nodes:
            # Neo4j Node对象的核心属性获取方式
            node_id = node.get("node_id", "")  # 节点唯一ID
            node_name = node.get("name", "")  # 节点的name属性
            node_label = list(node.labels)[0]  # 节点标签，比如Concept
            node_props = node._properties  # 节点的所有其他属性
            
            # 节点去重
            if node_id not in node_id_set:
                node_id_set.add(node_id)
                final_nodes.append({
                    "id": node_id,
                    "name": node_name,
                    "label": node_label,
                    **node_props
                })

        # 处理Neo4j原生Relationship对象
        raw_edges = record.get("edges", [])
        for rel in raw_edges:
            rel_id = rel.id  # 关系唯一ID
            rel_type = rel.type  # 关系类型，比如RELATE_TO
            source_id = rel.start_node.id  # 起点节点ID
            target_id = rel.end_node.id  # 终点节点ID
            rel_props = rel._properties  # 关系的所有其他属性
            final_edges.append({
                "id": rel_id,
                "source": source_id,
                "target": target_id,
                "type": rel_type,
                **rel_props
            })

    return final_nodes, final_edges

# 前端查询窗口接口定义
from fastapi import FastAPI
app = FastAPI(title="跨学科知识图谱-后端接口", version="1.0", docs_url="/docs")

@app.post("/api/kg/insert", summary="Agent对接接口：入库图谱数据")
async def api_insert_kg(kg_data: KGData):
    return insert_knowledge_graph(kg_data)

# 实时渲染：清空Neo4j所有数据
@app.get("/api/kg/clear/all", summary="清空全库（实时渲染）")
async def clear_all_data():
    with driver.session() as session:
        # DETACH DELETE会同时删除所有节点+关联边，一步清空
        session.run("MATCH (n) DETACH DELETE n")
    return {"status": "success", "msg": "旧数据已清空，可存入新关键词数据"}

@app.get("/api/kg/query/core", summary="前端核心接口：按核心概念查全图谱")
async def api_query_core(core_concept: str):
    with driver.session() as session:
        result = session.run("""
            MATCH (core:Concept {name: $core})
            OPTIONAL MATCH (core)-[*]-(related:Concept)
            WITH core, collect(DISTINCT related) AS related_nodes
            WITH core + related_nodes AS all_nodes
            OPTIONAL MATCH (a:Concept)-[r]-(b:Concept) 
            WHERE a IN all_nodes AND b IN all_nodes
            RETURN collect(DISTINCT a) + collect(DISTINCT b) AS nodes, collect(DISTINCT r) AS edges
        """, core=core_concept)
        
        nodes, edges = format_neo4j_result_to_standard_json(result)
        return {"meta": {"core_concept": core_concept}, "nodes": nodes, "edges": edges}

@app.get("/api/kg/query/all", summary="前端接口：查询全量图谱数据")
async def api_query_all():
    with driver.session() as session:
        result = session.run("""
            MATCH (a:Concept)-[r]-(b:Concept)
            WITH collect(DISTINCT a) + collect(DISTINCT b) AS all_nodes, collect(DISTINCT r) AS all_edges
            RETURN all_nodes AS nodes, all_edges AS edges  // 返回nodes/edges字段，适配格式化函数 """)
        nodes, edges = format_neo4j_result_to_standard_json(result)
        return {"meta": {"type": "全量数据"}, "nodes": nodes, "edges": edges}

@app.get("/api/kg/query/domain", summary="前端接口：按学科筛选图谱")
def api_query_domain(domain: str):
    with driver.session() as session:
        result = session.run("""
            MATCH (core:Concept {domain: $domain})
            OPTIONAL MATCH (a:Concept {domain: $domain})-[r]-(b:Concept {domain: $domain})
            RETURN collect(DISTINCT core) AS nodes, collect(DISTINCT r) AS edges """, domain=domain)
        nodes, edges = format_neo4j_result_to_standard_json(result)
        return {"meta": {"filter_domain": domain}, "nodes": nodes, "edges": edges}

@app.get("/api/kg/query/node/detail", summary="前端接口：查询单个节点的完整详情+直接关联关系")
def api_query_node_detail(node_name: str):
    with driver.session() as session:
        result = session.run("""
            MATCH (n:Concept {name: $name})
            OPTIONAL MATCH (n)-[r]-(related:Concept)
            RETURN collect(DISTINCT n) AS nodes, collect(DISTINCT related) + collect(DISTINCT n) AS all_nodes, collect(DISTINCT r) AS edges
        """, name=node_name)
        nodes, edges = format_neo4j_result_to_standard_json(result)
        # 提取节点详情（取第一个节点的属性）
        node_detail = nodes[0] if nodes else {}
        return {"meta": {"node_name": node_name}, "node_detail": node_detail, "nodes": nodes, "edges": edges}

@app.get("/api/kg/query/node/search", summary="前端接口：模糊搜索节点（匹配name/definition）")
def api_query_node_search(keyword: str):
    with driver.session() as session:
        result = session.run("""
            MATCH (n:Concept)
            WHERE n.name CONTAINS $keyword OR n.definition CONTAINS $keyword
            OPTIONAL MATCH (n)-[r]-(related:Concept)
            WITH collect(DISTINCT n) + collect(DISTINCT related) AS all_nodes, collect(DISTINCT r) AS edges
            RETURN all_nodes AS nodes, edges
        """, keyword=keyword)
        nodes, edges = format_neo4j_result_to_standard_json(result)
        return {"meta": {"keyword": keyword}, "nodes": nodes, "edges": edges}

@app.get("/api/kg/query/relation/type", summary="前端接口：按关系类型筛选图谱")
def api_query_relation_type(rel_type: str):
    with driver.session() as session:
        result = session.run("""
            MATCH (a:Concept)-[r]->(b:Concept)
            WHERE type(r) = $rel_type
            RETURN collect(DISTINCT a) + collect(DISTINCT b) AS nodes, collect(DISTINCT r) AS edges
        """, rel_type=rel_type)
        nodes, edges = format_neo4j_result_to_standard_json(result)
        return {"meta": {"relation_type": rel_type}, "nodes": nodes, "edges": edges}

@app.get("/api/kg/query/path/shortest", summary="前端接口：查询两个节点的最短关联路径")
def api_query_shortest_path(start_name: str, end_name: str):
    with driver.session() as session:
        result = session.run("""
            MATCH (start:Concept {name: $start}), (end:Concept {name: $end})
            MATCH p = shortestPath((start)-[*1..5]-(end))
            UNWIND nodes(p) AS n
            UNWIND relationships(p) AS r
            RETURN collect(DISTINCT n) AS nodes, collect(DISTINCT r) AS edges
        """, start=start_name, end=end_name)
        nodes, edges = format_neo4j_result_to_standard_json(result)
        return {"meta": {"start": start_name, "end": end_name}, "nodes": nodes, "edges": edges}

@app.get("/api/kg/query/domain/multi", summary="前端接口：多学科联合筛选图谱")
def api_query_multi_domain(domains: list[str]):
    with driver.session() as session:
        result = session.run("""
            MATCH (n:Concept)
            WHERE n.domain IN $domains
            OPTIONAL MATCH (n)-[r]-(related:Concept) WHERE related.domain IN $domains
            RETURN collect(DISTINCT n) AS nodes, collect(DISTINCT r) AS edges
        """, domains=domains)
        nodes, edges = format_neo4j_result_to_standard_json(result)
        return {"meta": {"domains": domains}, "nodes": nodes, "edges": edges}
    
if __name__ == "__main__":
    # 第一步：执行本地入库测试，把JSON数据写入Neo4j
    local_test_insert()
    # 第二步：启动FastAPI后端服务
    import uvicorn
    # Docker部署时，host改成0.0.0.0
    # uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False) 