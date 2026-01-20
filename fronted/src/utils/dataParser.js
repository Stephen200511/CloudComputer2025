// 解析后端JSON数据，转化为D3能识别的格式
export function parseGraphData(rawData) {
  // rawData：后端返回的原始JSON（和之前定义的格式一致）
  const { nodes, links, recommend } = rawData;

  // 处理节点：给每个节点添加唯一ID、学科颜色（方便区分）
  const parsedNodes = nodes.map((node) => ({
    id: node.id,
    name: node.name,
    subject: node.subject,
    desc: node.desc,
    color: getSubjectColor(node.subject), // 按学科分配颜色
  }));

  // 处理边：D3要求source和target是节点ID
  const parsedLinks = links.map((link) => ({
    source: link.source,
    target: link.target,
    type: link.type,
    basis: link.basis,
  }));

  return {
    nodes: parsedNodes,
    links: parsedLinks,
    recommend: recommend || [],
  };
}

// 按学科分配颜色（可自定义）
function getSubjectColor(subject) {
  const colorMap = {
    数学: "#e53e3e",
    物理: "#ed8936",
    计算机科学: "#48bb78",
    生物学: "#38b2ac",
    社会学: "#9f7aea",
    默认: "#718096",
  };
  return colorMap[subject] || colorMap["默认"];
}
