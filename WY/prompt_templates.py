def cross_domain_prompt(concept: str, disciplines: list = None) -> str:
    if not disciplines:
        disciplines = ["数学", "物理", "社会学", "生物学"]
    
    disciplines_str = "、".join(disciplines)
    
    return (
        f"角色：你是跨学科关联挖掘专家，需从{disciplines_str}等{len(disciplines)}个视角出发，寻找概念的核心关联，并提供可验证的“关联依据”，同时输出结构化结果。"
        f"输入：核心概念：{concept}"
        "要求：1. 在每个学科视角分别给出：关联概念、关联类型（定义/从属/类比/因果/应用/同源/对立等）、简要解释。"
        "2. 必须提供“关联依据”，包含：标题、作者/机构、年份、来源、可检索标识（如DOI/arXiv ID/ISBN/URL）。"
        "3. 优先引用权威来源。4. 输出时严格按照“结构化草案”字段名。"
        "5. 若某学科无合理关联，给出“暂无关联”，并推荐3个基础/邻近概念。"
        "6. 请以 JSON 格式输出结果。"
        "结构化草案：{"
        '"concept":"{concept}",'
        '"associations":[{"discipline":"","target_concept":"","definition":"概念定义","relation_type":"","explanation":"","confidence":0.9,"evidence":[{"title":"","authors":"","year":"","source":"","identifier":"","url":""}]}],'
        '"no_association":[{"discipline":"","message":"暂无关联","suggestions":["","",""]}]'
        "}"
    )

def verification_prompt(claim: str, title: str, summary: str) -> str:
    return (
        "角色：你是学术论文评审专家。\n"
        f"任务：验证论文是否支持该关联主张。\n"
        f"主张：{claim}\n"
        f"论文标题：{title}\n"
        f"论文摘要：{summary}\n"
        "要求：\n"
        "1. 判断摘要内容是否直接或间接支持该主张。\n"
        "2. 以 JSON 格式输出：{\"support\": true/false, \"reason\": \"简要理由\"}\n"
        "3. 如果摘要无关或仅提到关键词但未建立联系，返回 false。"
    )

KNOWN = {
    "熵": [
        {
            "discipline": "数学",
            "target_concept": "信息论",
            "relation_type": "定义",
            "explanation": "信息论中熵刻画不确定性与平均信息量。",
            "evidence": [
                {
                    "title": "A Mathematical Theory of Communication",
                    "authors": "Claude E. Shannon",
                    "year": "1948",
                    "source": "Bell System Technical Journal",
                    "identifier": "arXiv:2107.05013",
                    "url": "https://ieeexplore.ieee.org/document/6773024"
                }
            ]
        },
        {
            "discipline": "物理",
            "target_concept": "热力学",
            "relation_type": "从属",
            "explanation": "热力学熵度量微观态数与宏观无序。",
            "evidence": [
                {
                    "title": "Thermodynamics and Statistical Mechanics",
                    "authors": "R. K. Pathria",
                    "year": "1996",
                    "source": "Academic references",
                    "identifier": "",
                    "url": ""
                }
            ]
        }
    ],
    "最小二乘法": [
        {
            "discipline": "数学",
            "target_concept": "线性回归",
            "relation_type": "应用",
            "explanation": "以平方误差最小为准则的参数估计。",
            "evidence": [
                {
                    "title": "Least Squares Estimation",
                    "authors": "Gauss",
                    "year": "1809",
                    "source": "Theoria Motus",
                    "identifier": "",
                    "url": ""
                }
            ]
        },
        {
            "discipline": "社会学",
            "target_concept": "问卷分析",
            "relation_type": "应用",
            "explanation": "社会调查数据拟合与变量关系估计。",
            "evidence": [
                {
                    "title": "Applied Regression Analysis",
                    "authors": "N. R. Draper, H. Smith",
                    "year": "1998",
                    "source": "Wiley",
                    "identifier": "",
                    "url": ""
                }
            ]
        }
    ]
}

ALIASES = {
    "熵": ["entropy"],
    "信息论": ["information theory"],
    "最小二乘法": ["least squares", "least-squares"],
    "线性回归": ["linear regression"],
    "热力学": ["thermodynamics"]
}
