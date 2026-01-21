// ============== 全局变量和配置 ==============
let chartInstance = null;
let currentLayout = "force"; // 'force' 或 'circular'
let showLabels = true;
let allNodes = [];
let allEdges = [];
let currentNodes = [];
let currentEdges = [];
let nodeSize = 20;
let edgeWidth = 2;
let selectedNodeId = null;
const API_BASE = "http://localhost:8000"; // 后端地址

// 学科颜色映射
const DOMAIN_COLORS = {
  数学: "#5470c6",
  物理: "#91cc75",
  计算机科学: "#fac858",
  信息论: "#fac858",
  生物学: "#ee6666",
  社会学: "#73c0de",
  经济学: "#3ba272",
  化学: "#9a60b4",
  哲学: "#ff7c7c",
  心理学: "#3ba272",
  工程学: "#ff9d45",
  医学: "#ee6666",
};

// 关系类型颜色
const RELATION_COLORS = {
  包含: "#ff6b6b",
  推导: "#4ecdc4",
  应用: "#45b7d1",
  类比: "#96ceb4",
  相关: "#feca57",
  依赖: "#a4b0be",
  实例: "#ff9ff3",
  继承: "#54a0ff",
};

// ============== 初始化函数 ==============
function initApp() {
  console.log("初始化应用...");

  // 初始化ECharts
  initChart();

  // 初始化筛选器
  initDomainFilters();

  // 加载数据
  loadData();

  // 绑定事件
  bindEvents();

  // 更新状态
  updateStatus("应用已就绪");

  console.log("应用初始化完成");
}

function initChart() {
  const chartDom = document.getElementById("graphChart");
  if (!chartDom) {
    console.error("找不到图表容器");
    return;
  }

  chartInstance = echarts.init(chartDom);

  // 响应式
  window.addEventListener("resize", () => {
    if (chartInstance) {
      chartInstance.resize();
    }
  });

  // 设置基础配置
  const option = getBaseChartOption();
  chartInstance.setOption(option);

  // 绑定事件
  chartInstance.on("click", onChartClick);
  chartInstance.on("mouseover", onChartMouseOver);
  chartInstance.on("mouseout", onChartMouseOut);
  chartInstance.on("dblclick", onChartDoubleClick);
}

function getBaseChartOption() {
  return {
    animation: true,
    animationDuration: 1000,
    animationEasing: "cubicOut",
    tooltip: {
      trigger: "item",
      formatter: tooltipFormatter,
      backgroundColor: "rgba(255, 255, 255, 0.95)",
      borderColor: "#e2e8f0",
      borderWidth: 1,
      textStyle: {
        color: "#334155",
      },
      extraCssText:
        "box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border-radius: 8px;",
    },
    legend: {
      show: false,
    },
    series: [
      {
        type: "graph",
        layout: currentLayout,
        data: [],
        links: [],
        categories: Object.entries(DOMAIN_COLORS).map(([name, color]) => ({
          name: name,
          itemStyle: { color: color },
        })),
        roam: true,
        draggable: true,
        focusNodeAdjacency: true,
        edgeSymbol: ["circle", "arrow"],
        edgeSymbolSize: [4, 10],
        edgeLabel: {
          show: true,
          formatter: "{c}",
          fontSize: 10,
        },
        label: {
          show: showLabels,
          position: "right",
          formatter: "{b}",
          fontSize: 12,
          color: "#334155",
        },
        lineStyle: {
          color: "source",
          width: 2,
          curveness: 0.1,
          opacity: 0.8,
        },
        emphasis: {
          focus: "adjacency",
          lineStyle: {
            width: 3,
          },
          label: {
            show: true,
            fontWeight: "bold",
          },
        },
        force: {
          repulsion: 300,
          gravity: 0.1,
          edgeLength: 100,
        },
        circular: {
          rotateLabel: true,
        },
      },
    ],
  };
}

function tooltipFormatter(params) {
  if (params.dataType === "node") {
    const node = params.data;
    return `
        <div style="padding: 12px; min-width: 200px;">
            <div style="font-weight: 600; font-size: 16px; color: #1e293b; margin-bottom: 8px;">
                ${node.name}
            </div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${
                  node.itemStyle.color
                }"></span>
                <span style="font-size: 12px; color: #64748b;">${
                  node.domain
                }</span>
            </div>
            <div style="margin-bottom: 8px;">
                <div style="font-size: 12px; color: #64748b;">定义</div>
                <div style="font-size: 14px; color: #334155; line-height: 1.4;">${
                  node.definition || "暂无定义"
                }</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 12px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
                <span style="font-size: 12px; color: #64748b;">置信度</span>
                <span style="font-size: 14px; color: ${
                  node.confidence > 0.8
                    ? "#10b981"
                    : node.confidence > 0.6
                    ? "#f59e0b"
                    : "#ef4444"
                }">
                    ${Math.round(node.confidence * 100)}%
                </span>
            </div>
        </div>`;
  } else if (params.dataType === "edge") {
    const edge = params.data;
    return `
        <div style="padding: 12px; min-width: 200px;">
            <div style="font-weight: 600; font-size: 16px; color: #1e293b; margin-bottom: 8px;">
                ${edge.relation_type}
            </div>
            <div style="margin-bottom: 8px;">
                <div style="font-size: 12px; color: #64748b;">描述</div>
                <div style="font-size: 14px; color: #334155; line-height: 1.4;">${
                  edge.relation_desc
                }</div>
            </div>
            <div style="margin-bottom: 8px;">
                <div style="font-size: 12px; color: #64748b;">依据</div>
                <div style="font-size: 14px; color: #334155; line-height: 1.4;">${
                  edge.evidence || "领域专家标注"
                }</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 12px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
                <span style="font-size: 12px; color: #64748b;">置信度</span>
                <span style="font-size: 14px; color: ${
                  edge.confidence > 0.8
                    ? "#10b981"
                    : edge.confidence > 0.6
                    ? "#f59e0b"
                    : "#ef4444"
                }">
                    ${Math.round(edge.confidence * 100)}%
                </span>
            </div>
        </div>`;
  }
  return "";
}

// ============== 数据加载和转换 ==============
async function loadData() {
  showLoading("正在从后端加载数据...");

  try {
    // 调用后端接口获取全量数据
    const response = await fetch(`${API_BASE}/api/kg/query/all`);
    const result = await response.json();

    if (result && result.nodes) {
      // 转换数据格式
      allNodes = transformNodes(result.nodes);
      allEdges = transformEdges(result.edges || []);

      currentNodes = [...allNodes];
      currentEdges = [...allEdges];

      Graph();
      updateStats();
      hideLoading();
      updateStatus(
        `数据加载完成: ${allNodes.length}个节点, ${allEdges.length}条边`
      );
    } else {
      // 如果后端没数据，使用示例数据
      console.warn("后端暂无数据，使用示例数据");
      loadSampleData();
    }
  } catch (error) {
    console.error("API调用失败:", error);
    updateStatus("后端连接失败，使用本地示例数据");
    loadSampleData();
  }
}

function transformNodes(apiNodes) {
  return apiNodes.map((node) => ({
    id: node.id || node.node_id, // 适配后端的node_id字段
    name: node.name,
    domain: node.domain,
    definition: node.definition || node.desc || "",
    confidence: node.confidence || 0.8,
    x: node.x || undefined,
    y: node.y || undefined,
    // 保留其他原始属性
    ...node,
  }));
}

function transformEdges(apiEdges) {
  return apiEdges.map((edge) => ({
    id: `${edge.source || edge.source_node_id}-${
      edge.target || edge.target_node_id
    }`,
    source: edge.source || edge.source_node_id,
    target: edge.target || edge.target_node_id,
    relation_type: edge.relation_type || edge.type,
    relation_desc: edge.relation_desc || edge.desc || "",
    confidence: edge.confidence || 0.7,
    evidence: edge.evidence || "",
    // 保留其他原始属性
    ...edge,
  }));
}

function loadSampleData() {
  const sampleData = getSampleData();
  allNodes = sampleData.nodes;
  allEdges = sampleData.edges;
  currentNodes = [...allNodes];
  currentEdges = [...allEdges];

  renderGraph();
  updateStats();
  hideLoading();
  updateStatus("本地示例数据加载完成");
}

function getSampleData() {
  return {
    nodes: [
      // 数学相关
      {
        id: "math_1",
        name: "集合论",
        domain: "数学",
        definition: "研究集合及其性质的数学分支",
        confidence: 0.95,
      },
      {
        id: "math_2",
        name: "概率论",
        domain: "数学",
        definition: "研究随机现象数量规律的数学分支",
        confidence: 0.96,
      },
      {
        id: "math_3",
        name: "微积分",
        domain: "数学",
        definition: "研究变化和积分的数学分支",
        confidence: 0.98,
      },
      {
        id: "math_4",
        name: "线性代数",
        domain: "数学",
        definition: "研究向量空间和线性映射的数学分支",
        confidence: 0.97,
      },

      // 物理相关
      {
        id: "phy_1",
        name: "牛顿力学",
        domain: "物理",
        definition: "经典力学的基础理论",
        confidence: 0.99,
      },
      {
        id: "phy_2",
        name: "热力学",
        domain: "物理",
        definition: "研究热现象的物理学分支",
        confidence: 0.96,
      },
      {
        id: "phy_3",
        name: "量子力学",
        domain: "物理",
        definition: "描述微观粒子行为的物理学理论",
        confidence: 0.94,
      },
      {
        id: "phy_4",
        name: "相对论",
        domain: "物理",
        definition: "爱因斯坦提出的时空理论",
        confidence: 0.93,
      },

      // 计算机科学相关
      {
        id: "cs_1",
        name: "算法",
        domain: "计算机科学",
        definition: "解决问题的明确步骤",
        confidence: 0.97,
      },
      {
        id: "cs_2",
        name: "数据结构",
        domain: "计算机科学",
        definition: "数据的组织、管理和存储格式",
        confidence: 0.96,
      },
      {
        id: "cs_3",
        name: "机器学习",
        domain: "计算机科学",
        definition: "让计算机从数据中学习的技术",
        confidence: 0.92,
      },
      {
        id: "cs_4",
        name: "神经网络",
        domain: "计算机科学",
        definition: "模拟人脑神经元的计算模型",
        confidence: 0.91,
      },

      // 信息论相关
      {
        id: "info_1",
        name: "信息熵",
        domain: "信息论",
        definition: "信息不确定性的度量",
        confidence: 0.95,
      },
      {
        id: "info_2",
        name: "香农定理",
        domain: "信息论",
        definition: "信道容量的计算公式",
        confidence: 0.93,
      },
      {
        id: "info_3",
        name: "编码理论",
        domain: "信息论",
        definition: "研究信息编码和传输的理论",
        confidence: 0.92,
      },

      // 跨学科概念
      {
        id: "cross_1",
        name: "熵",
        domain: "物理",
        definition: "热力学中表征物质状态的参量",
        confidence: 0.95,
      },
      {
        id: "cross_2",
        name: "熵",
        domain: "信息论",
        definition: "信息不确定性的度量",
        confidence: 0.92,
      },
      {
        id: "cross_3",
        name: "优化",
        domain: "数学",
        definition: "寻找最佳解决方案的过程",
        confidence: 0.94,
      },
      {
        id: "cross_4",
        name: "优化算法",
        domain: "计算机科学",
        definition: "解决优化问题的计算方法",
        confidence: 0.91,
      },

      // 其他学科
      {
        id: "bio_1",
        name: "进化论",
        domain: "生物学",
        definition: "生物种群特征随时间变化的理论",
        confidence: 0.97,
      },
      {
        id: "eco_1",
        name: "博弈论",
        domain: "经济学",
        definition: "研究策略互动的数学理论",
        confidence: 0.94,
      },
      {
        id: "soc_1",
        name: "社会网络",
        domain: "社会学",
        definition: "社会实体间关系的集合",
        confidence: 0.89,
      },
    ],
    edges: [
      // 数学内部关联
      {
        source: "math_1",
        target: "math_2",
        relation_type: "基础",
        relation_desc: "概率论建立在集合论基础上",
        confidence: 0.85,
      },
      {
        source: "math_3",
        target: "math_2",
        relation_type: "工具",
        relation_desc: "微积分是概率论的重要工具",
        confidence: 0.82,
      },

      // 物理内部关联
      {
        source: "phy_1",
        target: "phy_2",
        relation_type: "应用",
        relation_desc: "牛顿力学应用于热力学研究",
        confidence: 0.78,
      },
      {
        source: "phy_3",
        target: "phy_4",
        relation_type: "互补",
        relation_desc: "量子力学与相对论是现代物理两大支柱",
        confidence: 0.75,
      },

      // 计算机科学内部关联
      {
        source: "cs_1",
        target: "cs_2",
        relation_type: "依赖",
        relation_desc: "算法效率依赖于数据结构",
        confidence: 0.92,
      },
      {
        source: "cs_3",
        target: "cs_4",
        relation_type: "包含",
        relation_desc: "神经网络是机器学习的重要分支",
        confidence: 0.88,
      },

      // 跨学科关联
      {
        source: "cross_1",
        target: "cross_2",
        relation_type: "类比",
        relation_desc: "热力学熵与信息熵的数学形式相似",
        confidence: 0.82,
      },
      {
        source: "cross_3",
        target: "cross_4",
        relation_type: "应用",
        relation_desc: "数学优化理论应用于计算机算法设计",
        confidence: 0.86,
      },
      {
        source: "math_2",
        target: "info_1",
        relation_type: "基础",
        relation_desc: "信息熵基于概率论定义",
        confidence: 0.91,
      },
      {
        source: "phy_3",
        target: "cs_4",
        relation_type: "启发",
        relation_desc: "量子力学启发了量子神经网络研究",
        confidence: 0.72,
      },
      {
        source: "bio_1",
        target: "cs_3",
        relation_type: "启发",
        relation_desc: "进化论启发了遗传算法设计",
        confidence: 0.68,
      },
      {
        source: "eco_1",
        target: "cs_3",
        relation_type: "应用",
        relation_desc: "博弈论应用于多智能体系统研究",
        confidence: 0.76,
      },
      {
        source: "soc_1",
        target: "cs_4",
        relation_type: "类比",
        relation_desc: "社会网络与神经网络结构的相似性",
        confidence: 0.65,
      },
    ],
  };
}

// ============== 图谱渲染 ==============
function renderGraph() {
  if (!chartInstance) return;

  const chartData = prepareChartData();

  const currentOption = chartInstance.getOption();

  chartInstance.setOption({
    series: [
      {
        layout: currentLayout, // 关键：设置当前布局
        data: chartData.nodes,
        links: chartData.edges,
        force:
          currentLayout === "force"
            ? {
                repulsion: 300,
                gravity: 0.1,
                edgeLength: 100,
                layoutAnimation: true,
              }
            : undefined,
        circular:
          currentLayout === "circular"
            ? {
                rotateLabel: true,
              }
            : undefined,
      },
    ],
  });

  updateStats();
}

function prepareChartData() {
  // 准备节点数据
  const nodes = currentNodes.map((node) => ({
    id: node.id,
    name: node.name,
    category: node.domain,
    value: node.confidence,
    symbolSize: nodeSize * Math.max(0.5, node.confidence),
    x: node.x || undefined,
    y: node.y || undefined,
    itemStyle: {
      color: DOMAIN_COLORS[node.domain] || "#94a3b8",
    },
    label: {
      show: showLabels,
      fontSize: Math.max(10, nodeSize / 2),
    },
    // 自定义属性
    domain: node.domain,
    definition: node.definition,
    confidence: node.confidence,
  }));

  // 准备边数据
  const edges = currentEdges.map((edge) => ({
    id: `${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    value: edge.relation_type,
    lineStyle: {
      width: edgeWidth * Math.max(0.5, edge.confidence),
      color: RELATION_COLORS[edge.relation_type] || "#a4b0be",
      curveness: 0.1,
      opacity: 0.7 + edge.confidence * 0.3,
    },
    label: {
      show: true,
      formatter: edge.relation_type,
      fontSize: 10,
    },
    // 自定义属性
    relation_type: edge.relation_type,
    relation_desc: edge.relation_desc,
    confidence: edge.confidence,
    evidence: edge.evidence,
  }));

  return { nodes, edges };
}

// ============== 交互函数 ==============
function onChartClick(params) {
  if (params.dataType === "node") {
    selectNode(params.data.id);
  } else if (params.dataType === "edge") {
    showEdgeInfo(params.data);
  }
}

function onChartMouseOver(params) {
  if (params.dataType === "node") {
    highlightNodeRelations(params.data.id);
  }
}

function onChartMouseOut() {
  resetHighlight();
}

function onChartDoubleClick(params) {
  if (params.dataType === "node") {
    expandNode(params.data.id);
  }
}

function selectNode(nodeId) {
  selectedNodeId = nodeId;
  const node = currentNodes.find((n) => n.id === nodeId);

  if (node) {
    showNodeInfo(node);
    highlightNodeRelations(nodeId);

    // 调用后端获取完整详情
    fetchNodeDetail(node.name);
  }
}

function highlightNodeRelations(nodeId) {
  if (!chartInstance) return;

  const relatedEdges = currentEdges.filter(
    (edge) => edge.source === nodeId || edge.target === nodeId
  );

  const relatedNodeIds = new Set([nodeId]);
  relatedEdges.forEach((edge) => {
    relatedNodeIds.add(edge.source);
    relatedNodeIds.add(edge.target);
  });

  // 更新节点样式
  const nodes = currentNodes.map((node) => {
    const isRelated = relatedNodeIds.has(node.id);
    return {
      ...node,
      itemStyle: {
        color: isRelated ? DOMAIN_COLORS[node.domain] || "#94a3b8" : "#e2e8f0",
        opacity: isRelated ? 1 : 0.3,
      },
    };
  });

  // 更新边样式
  const edges = currentEdges.map((edge) => {
    const isRelated = relatedEdges.some(
      (e) => e.source === edge.source && e.target === edge.target
    );
    return {
      ...edge,
      lineStyle: {
        ...edge.lineStyle,
        opacity: isRelated ? 1 : 0.2,
      },
    };
  });

  chartInstance.setOption({
    series: [
      {
        data: nodes,
        links: edges,
      },
    ],
  });
}

function resetHighlight() {
  renderGraph();
}

function expandNode(nodeId) {
  const node = currentNodes.find((n) => n.id === nodeId);
  if (!node) return;

  updateStatus(`正在探索与 "${node.name}" 相关的概念...`);

  // 这里可以调用API获取更多相关节点
  // 现在先显示一个消息
  showModal(
    `深度探索: ${node.name}`,
    `
        <div style="padding: 20px;">
            <h3 style="margin-bottom: 16px;">${node.name} 的深入探索</h3>
            <p style="margin-bottom: 16px;"><strong>学科:</strong> ${node.domain}</p>
            <p style="margin-bottom: 16px;"><strong>定义:</strong> ${node.definition}</p>
            <p style="margin-bottom: 16px;">此功能将调用智能体API，挖掘更多跨学科关联。</p>
            <div style="display: flex; gap: 12px; margin-top: 24px;">
                <button onclick="callAgentAPI('${nodeId}')" class="btn-small btn-primary">调用智能体挖掘</button>
                <button onclick="closeModal()" class="btn-small">关闭</button>
            </div>
        </div>
    `
  );
}

// ============== 筛选和搜索 ==============
function initDomainFilters() {
  const filtersContainer = document.getElementById("domainFilters");
  if (!filtersContainer) return;

  // 清空容器
  filtersContainer.innerHTML = "";

  // 创建筛选器项目
  Object.entries(DOMAIN_COLORS).forEach(([domain, color]) => {
    const filterItem = document.createElement("div");
    filterItem.className = "domain-filter-item";
    filterItem.innerHTML = `
            <div class="domain-color" style="background: ${color}"></div>
            <span>${domain}</span>
            <input type="checkbox" style="margin-left: auto;" checked 
                   onchange="toggleDomainFilter('${domain}', this.checked)">
        `;
    filtersContainer.appendChild(filterItem);
  });
}

function toggleDomainFilter(domain, selected) {
  console.log(`切换学科筛选: ${domain} - ${selected ? "选中" : "取消"}`);
  // 筛选逻辑在 applyFilters 中实现
}

async function applyFilters() {
  const checkboxes = document.querySelectorAll(
    '.domain-filter-item input[type="checkbox"]'
  );
  const selectedDomains = [];

  checkboxes.forEach((cb) => {
    if (cb.checked) {
      // 从父元素获取学科名称
      const domain = cb.parentElement.querySelector("span").textContent;
      selectedDomains.push(domain);
    }
  });

  if (selectedDomains.length === 0) {
    // 如果没选任何学科，显示全部
    currentNodes = [...allNodes];
    currentEdges = [...allEdges];
    renderGraph();
    updateStatus("已显示全部数据");
    return;
  }

  showLoading(`正在筛选: ${selectedDomains.join(", ")}`);

  try {
    // 调用后端多学科筛选接口
    const queryString = selectedDomains
      .map((d) => `domains=${encodeURIComponent(d)}`)
      .join("&");
    const response = await fetch(
      `${API_BASE}/api/kg/query/domain/multi?${queryString}`
    );
    const result = await response.json();

    if (result && result.nodes) {
      currentNodes = transformNodes(result.nodes);
      currentEdges = transformEdges(result.edges || []);

      renderGraph();
      updateStatus(
        `已筛选: ${selectedDomains.join(", ")} (${currentNodes.length}个概念)`
      );
    } else {
      updateStatus("筛选未找到数据");
      fallbackFilter(selectedDomains);
    }
  } catch (error) {
    console.error("筛选失败:", error);
    updateStatus("筛选失败，使用本地筛选");
    fallbackFilter(selectedDomains);
  } finally {
    hideLoading();
  }
}

function fallbackFilter(selectedDomains) {
  // 前端筛选逻辑（兼容模式）
  currentNodes = allNodes.filter((node) =>
    selectedDomains.includes(node.domain)
  );

  const filteredNodeIds = new Set(currentNodes.map((n) => n.id));
  currentEdges = allEdges.filter(
    (edge) =>
      filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
  );

  renderGraph();
  updateStatus(`前端筛选: ${selectedDomains.join(", ")}`);
}

function selectAllDomains() {
  document
    .querySelectorAll('.domain-filter-item input[type="checkbox"]')
    .forEach((cb) => {
      cb.checked = true;
    });
  applyFilters();
}

function clearAllDomains() {
  document
    .querySelectorAll('.domain-filter-item input[type="checkbox"]')
    .forEach((cb) => {
      cb.checked = false;
    });
  applyFilters();
}

async function searchConcept() {
  const input = document.getElementById("searchInput");
  const keyword = input.value.trim();

  if (!keyword) {
    updateStatus("请输入搜索关键词");
    return;
  }

  showLoading(`正在搜索: ${keyword}`);
  updateStatus(`搜索: ${keyword}`);

  try {
    // 调用后端搜索接口
    const response = await fetch(
      `${API_BASE}/api/kg/query/node/search?keyword=${encodeURIComponent(
        keyword
      )}`
    );
    const result = await response.json();

    if (result && result.nodes) {
      // 转换数据格式
      allNodes = transformNodes(result.nodes);
      allEdges = transformEdges(result.edges || []);

      currentNodes = [...allNodes];
      currentEdges = [...allEdges];

      renderGraph();

      // 高亮第一个匹配的节点
      if (currentNodes.length > 0) {
        const matchedNode = currentNodes.find((n) =>
          n.name.toLowerCase().includes(keyword.toLowerCase())
        );
        if (matchedNode) {
          selectNode(matchedNode.id);
        }
      }

      updateStatus(`找到 ${currentNodes.length} 个相关概念`);
    } else {
      updateStatus("未找到相关概念");
    }
  } catch (error) {
    console.error("搜索失败:", error);
    updateStatus("搜索失败，请检查网络连接");

    // 本地搜索作为降级方案
    localSearch(keyword);
  } finally {
    hideLoading();
    input.value = "";
    input.placeholder = `搜索"${keyword}"的结果`;
  }
}

function localSearch(keyword) {
  // 本地搜索逻辑（降级方案）
  const matchedNodes = allNodes.filter(
    (node) =>
      node.name.toLowerCase().includes(keyword.toLowerCase()) ||
      (node.definition &&
        node.definition.toLowerCase().includes(keyword.toLowerCase()))
  );

  if (matchedNodes.length === 0) {
    showModal(
      "搜索结果",
      `
            <div style="padding: 20px;">
                <h3 style="margin-bottom: 16px;">未找到相关概念</h3>
                <p style="margin-bottom: 16px;">未找到包含 "<strong>${keyword}</strong>" 的概念。</p>
                <p style="margin-bottom: 16px;">建议：</p>
                <ul style="margin-bottom: 16px; padding-left: 20px;">
                    <li>检查拼写是否正确</li>
                    <li>尝试更通用的关键词</li>
                    <li>使用英文术语搜索</li>
                </ul>
                <button onclick="closeModal()" class="btn-small btn-primary">确定</button>
            </div>
        `
    );
    return;
  }

  // 查找关联的边和节点
  const matchedNodeIds = new Set(matchedNodes.map((n) => n.id));
  const relatedEdges = allEdges.filter(
    (edge) => matchedNodeIds.has(edge.source) || matchedNodeIds.has(edge.target)
  );

  // 收集所有相关节点
  const relatedNodeIds = new Set(matchedNodeIds);
  relatedEdges.forEach((edge) => {
    relatedNodeIds.add(edge.source);
    relatedNodeIds.add(edge.target);
  });

  currentNodes = allNodes.filter((node) => relatedNodeIds.has(node.id));
  currentEdges = relatedEdges;

  renderGraph();

  // 高亮第一个匹配的节点
  if (matchedNodes.length > 0) {
    selectNode(matchedNodes[0].id);
  }

  updateStatus(`本地搜索找到 ${matchedNodes.length} 个相关概念`);
}

async function showRandomGraph() {
  // 从现有学科中随机选择
  const domains = [...new Set(allNodes.map((n) => n.domain))].filter((d) => d);

  if (domains.length < 2) {
    updateStatus("数据不足，无法随机探索");
    return;
  }

  // 随机选择1-3个学科
  const randomCount = Math.floor(Math.random() * 3) + 1;
  const randomDomains = [];

  while (
    randomDomains.length < randomCount &&
    randomDomains.length < domains.length
  ) {
    const randomDomain = domains[Math.floor(Math.random() * domains.length)];
    if (!randomDomains.includes(randomDomain)) {
      randomDomains.push(randomDomain);
    }
  }

  showLoading(`随机探索: ${randomDomains.join(", ")}`);

  try {
    // 调用后端多学科筛选接口
    const queryString = randomDomains
      .map((d) => `domains=${encodeURIComponent(d)}`)
      .join("&");
    const response = await fetch(
      `${API_BASE}/api/kg/query/domain/multi?${queryString}`
    );
    const result = await response.json();

    if (result && result.nodes && result.nodes.length > 0) {
      currentNodes = transformNodes(result.nodes);
      currentEdges = transformEdges(result.edges || []);

      renderGraph();

      // 随机选择一个节点高亮
      if (currentNodes.length > 0) {
        const randomNode =
          currentNodes[Math.floor(Math.random() * currentNodes.length)];
        selectNode(randomNode.id);
      }

      updateStatus(`随机探索: ${randomDomains.join(", ")}`);
    } else {
      updateStatus("随机探索未找到数据");
      fallbackRandomGraph(randomDomains);
    }
  } catch (error) {
    console.error("随机探索失败:", error);
    updateStatus("随机探索失败，使用本地数据");
    fallbackRandomGraph(randomDomains);
  } finally {
    hideLoading();
  }
}

function fallbackRandomGraph(randomDomains) {
  // 前端筛选逻辑（兼容模式）
  currentNodes = allNodes.filter((node) => randomDomains.includes(node.domain));

  const filteredNodeIds = new Set(currentNodes.map((n) => n.id));
  currentEdges = allEdges.filter(
    (edge) =>
      filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
  );

  renderGraph();

  // 随机选择一个节点高亮
  if (currentNodes.length > 0) {
    const randomNode =
      currentNodes[Math.floor(Math.random() * currentNodes.length)];
    selectNode(randomNode.id);
  }

  updateStatus(`本地随机探索: ${randomDomains.join(", ")}`);
}

// ============== 视图控制 ==============
function zoomIn() {
  if (!chartInstance) return;

  const option = chartInstance.getOption();
  const currentZoom = option.series[0].zoom || 1;

  chartInstance.setOption({
    series: [
      {
        zoom: Math.min(currentZoom * 1.2, 5),
      },
    ],
  });

  updateStatus("已放大");
}

function zoomOut() {
  if (!chartInstance) return;

  const option = chartInstance.getOption();
  const currentZoom = option.series[0].zoom || 1;

  chartInstance.setOption({
    series: [
      {
        zoom: Math.max(currentZoom * 0.8, 0.2),
      },
    ],
  });

  updateStatus("已缩小");
}

function resetView() {
  if (!chartInstance) return;

  chartInstance.setOption({
    series: [
      {
        zoom: 1,
      },
    ],
  });

  updateStatus("视图已重置");
}

function toggleLayout() {
  currentLayout = currentLayout === "force" ? "circular" : "force";

  renderGraph();

  document.getElementById("layoutType").textContent =
    currentLayout === "force" ? "力导向" : "环形";

  updateStatus(
    `布局切换为: ${currentLayout === "force" ? "力导向布局" : "环形布局"}`
  );
}

function updateNodeSize(value) {
  nodeSize = parseInt(value);
  document.getElementById("nodeSizeValue").textContent = value;
  renderGraph();
}

function updateEdgeWidth(value) {
  edgeWidth = parseInt(value);
  document.getElementById("edgeWidthValue").textContent = value;
  renderGraph();
}

function toggleLabels() {
  showLabels = !showLabels;
  renderGraph();
  updateStatus(`标签显示: ${showLabels ? "开启" : "关闭"}`);
}

function showFullscreen() {
  const elem = document.getElementById("graphChart");

  if (!document.fullscreenElement) {
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    }
    updateStatus("进入全屏模式");
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
    updateStatus("退出全屏模式");
  }
}

// ============== 信息展示 ==============
async function fetchNodeDetail(nodeName) {
  try {
    const response = await fetch(
      `${API_BASE}/api/kg/query/node/detail?node_name=${encodeURIComponent(
        nodeName
      )}`
    );
    const result = await response.json();

    if (result && result.node_detail) {
      // 显示更详细的节点信息
      showNodeDetail(result);
    }
  } catch (error) {
    console.error("获取节点详情失败:", error);
    // 使用前端缓存的数据
  }
}

function showNodeInfo(node) {
  const infoContainer = document.getElementById("nodeInfo");
  if (!infoContainer) return;

  // 查找相关的边
  const relatedEdges = currentEdges.filter(
    (edge) => edge.source === node.id || edge.target === node.id
  );

  // 查找关联的节点
  const relatedNodeIds = new Set();
  relatedEdges.forEach((edge) => {
    if (edge.source !== node.id) relatedNodeIds.add(edge.source);
    if (edge.target !== node.id) relatedNodeIds.add(edge.target);
  });

  const relatedNodes = currentNodes.filter((n) => relatedNodeIds.has(n.id));

  infoContainer.innerHTML = `
        <div class="node-details">
            <div class="node-header">
                <div class="node-title">${node.name}</div>
                <div class="node-domain" style="background: ${
                  DOMAIN_COLORS[node.domain] || "#94a3b8"
                }">
                    ${node.domain}
                </div>
            </div>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">定义</div>
                    <div class="info-value">${
                      node.definition || "暂无定义"
                    }</div>
                </div>
                <div class="info-item">
                    <div class="info-label">置信度</div>
                    <div class="info-value">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px;">
                                <div style="width: ${
                                  node.confidence * 100
                                }%; height: 100%; 
                                     background: ${
                                       node.confidence > 0.8
                                         ? "#10b981"
                                         : node.confidence > 0.6
                                         ? "#f59e0b"
                                         : "#ef4444"
                                     }; 
                                     border-radius: 3px;"></div>
                            </div>
                            <span>${Math.round(node.confidence * 100)}%</span>
                        </div>
                    </div>
                </div>
                <div class="info-item">
                    <div class="info-label">关联概念</div>
                    <div class="info-value">${relatedNodes.length} 个</div>
                </div>
            </div>
            
            ${
              relatedEdges.length > 0
                ? `
            <div class="relations-list">
                <h4>主要关联</h4>
                ${relatedEdges
                  .slice(0, 3)
                  .map((edge) => {
                    const targetNode = relatedNodes.find(
                      (n) =>
                        n.id ===
                        (edge.source === node.id ? edge.target : edge.source)
                    );
                    if (!targetNode) return "";

                    return `
                    <div class="relation-item">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <strong style="color: #1e293b;">${
                              edge.relation_type
                            }</strong>
                            <span style="font-size: 12px; color: #64748b;">
                                ${Math.round(edge.confidence * 100)}%
                            </span>
                        </div>
                        <div style="font-size: 13px; color: #475569;">
                            ${node.name} → ${targetNode.name}
                        </div>
                        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                            ${edge.relation_desc}
                        </div>
                    </div>`;
                  })
                  .join("")}
                
                ${
                  relatedEdges.length > 3
                    ? `
                <div style="text-align: center; margin-top: 8px;">
                    <button onclick="showAllRelations('${node.id}')" 
                            style="background: none; border: none; color: #3b82f6; cursor: pointer; font-size: 12px;">
                        查看更多关联 (${relatedEdges.length - 3}个)
                    </button>
                </div>
                `
                    : ""
                }
            </div>
            `
                : `
            <div style="text-align: center; color: #94a3b8; padding: 20px;">
                暂无关联信息
            </div>
            `
            }
        </div>
    `;
}

function showNodeDetail(apiResult) {
  const node = apiResult.node_detail;
  const nodes = apiResult.nodes || [];
  const edges = apiResult.edges || [];

  const infoContainer = document.getElementById("nodeInfo");
  if (!infoContainer) return;

  // 创建更丰富的详情显示
  infoContainer.innerHTML = `
    <div class="node-details">
        <div class="node-header">
            <div class="node-title">${node.name}</div>
            <div class="node-domain" style="background: ${
              DOMAIN_COLORS[node.domain] || "#94a3b8"
            }">
                ${node.domain}
            </div>
        </div>
        
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">定义</div>
                <div class="info-value">${node.definition || "暂无定义"}</div>
            </div>
            <div class="info-item">
                <div class="info-label">置信度</div>
                <div class="info-value">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px;">
                            <div style="width: ${
                              (node.confidence || 0.8) * 100
                            }%; height: 100%; 
                                 background: ${
                                   node.confidence > 0.8
                                     ? "#10b981"
                                     : node.confidence > 0.6
                                     ? "#f59e0b"
                                     : "#ef4444"
                                 }; 
                                 border-radius: 3px;"></div>
                        </div>
                        <span>${Math.round(
                          (node.confidence || 0.8) * 100
                        )}%</span>
                    </div>
                </div>
            </div>
            <div class="info-item">
                <div class="info-label">关联数量</div>
                <div class="info-value">${edges.length} 条关联</div>
            </div>
        </div>
        
        ${
          edges.length > 0
            ? `
        <div class="relations-list">
            <h4>直接关联</h4>
            ${edges
              .slice(0, 5)
              .map((edge) => {
                const sourceNode = nodes.find((n) => n.id === edge.source);
                const targetNode = nodes.find((n) => n.id === edge.target);
                if (!sourceNode || !targetNode) return "";

                const relationNode =
                  edge.source === node.id ? targetNode : sourceNode;
                const direction = edge.source === node.id ? "→" : "←";

                return `
                <div class="relation-item">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <strong style="color: #1e293b;">${
                          edge.relation_type || edge.type
                        }</strong>
                        <span style="font-size: 12px; color: #64748b;">
                            ${Math.round((edge.confidence || 0.7) * 100)}%
                        </span>
                    </div>
                    <div style="font-size: 13px; color: #475569;">
                        ${
                          edge.source === node.id
                            ? node.name
                            : relationNode.name
                        } 
                        ${direction} 
                        ${
                          edge.source === node.id
                            ? relationNode.name
                            : node.name
                        }
                    </div>
                    <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                        ${edge.relation_desc || ""}
                    </div>
                </div>`;
              })
              .join("")}
        </div>
        `
            : `
        <div style="text-align: center; color: #94a3b8; padding: 20px;">
            暂无关联信息
        </div>
        `
        }
    </div>
  `;
}

function showEdgeInfo(edgeData) {
  const sourceNode = currentNodes.find((n) => n.id === edgeData.source);
  const targetNode = currentNodes.find((n) => n.id === edgeData.target);

  if (!sourceNode || !targetNode) return;

  showModal(
    "关联详情",
    `
        <div style="padding: 20px;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 24px;">
                <div style="text-align: center;">
                    <div style="font-size: 14px; color: #64748b; margin-bottom: 4px;">来源概念</div>
                    <div style="font-weight: 600; color: #1e293b;">${
                      sourceNode.name
                    }</div>
                    <div style="font-size: 12px; color: #94a3b8;">${
                      sourceNode.domain
                    }</div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <div style="width: 2px; height: 40px; background: ${
                      RELATION_COLORS[edgeData.relation_type] || "#a4b0be"
                    };"></div>
                    <div style="padding: 6px 12px; background: ${
                      RELATION_COLORS[edgeData.relation_type] || "#a4b0be"
                    }; 
                         color: white; border-radius: 12px; font-size: 12px; font-weight: 500; margin: 4px 0;">
                        ${edgeData.relation_type}
                    </div>
                    <div style="width: 2px; height: 40px; background: ${
                      RELATION_COLORS[edgeData.relation_type] || "#a4b0be"
                    };"></div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 14px; color: #64748b; margin-bottom: 4px;">目标概念</div>
                    <div style="font-weight: 600; color: #1e293b;">${
                      targetNode.name
                    }</div>
                    <div style="font-size: 12px; color: #94a3b8;">${
                      targetNode.domain
                    }</div>
                </div>
            </div>
            
            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="font-weight: 500; color: #1e293b;">关联描述</div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="font-size: 12px; color: #64748b;">置信度</div>
                        <div style="font-size: 14px; font-weight: 600; 
                             color: ${
                               edgeData.confidence > 0.8
                                 ? "#10b981"
                                 : edgeData.confidence > 0.6
                                 ? "#f59e0b"
                                 : "#ef4444"
                             }">
                            ${Math.round(edgeData.confidence * 100)}%
                        </div>
                    </div>
                </div>
                <div style="color: #475569; line-height: 1.5;">${
                  edgeData.relation_desc
                }</div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="font-weight: 500; color: #1e293b; margin-bottom: 8px;">关联依据</div>
                <div style="color: #475569; line-height: 1.5;">
                    ${edgeData.evidence || "来源于领域专家标注和学术文献验证"}
                </div>
            </div>
            
            <div style="display: flex; gap: 12px; margin-top: 24px;">
                <button onclick="focusOnEdge('${edgeData.source}', '${
      edgeData.target
    }')" 
                        class="btn-small btn-primary">聚焦查看</button>
                <button onclick="closeModal()" class="btn-small">关闭</button>
            </div>
        </div>
    `
  );
}

function showAllRelations(nodeId) {
  const node = currentNodes.find((n) => n.id === nodeId);
  if (!node) return;

  const relatedEdges = currentEdges.filter(
    (edge) => edge.source === nodeId || edge.target === nodeId
  );

  const relatedNodeIds = new Set();
  relatedEdges.forEach((edge) => {
    if (edge.source !== nodeId) relatedNodeIds.add(edge.source);
    if (edge.target !== nodeId) relatedNodeIds.add(edge.target);
  });

  const relatedNodes = currentNodes.filter((n) => relatedNodeIds.has(n.id));

  let relationsHTML = "";
  relatedEdges.forEach((edge) => {
    const targetNode = relatedNodes.find(
      (n) => n.id === (edge.source === nodeId ? edge.target : edge.source)
    );
    if (!targetNode) return;

    const direction = edge.source === nodeId ? "→" : "←";

    relationsHTML += `
        <div style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 8px; height: 8px; border-radius: 50%; 
                         background: ${
                           RELATION_COLORS[edge.relation_type] || "#a4b0be"
                         };"></div>
                    <span style="font-weight: 500; color: #1e293b;">${
                      edge.relation_type
                    }</span>
                </div>
                <span style="font-size: 12px; color: #64748b;">${Math.round(
                  edge.confidence * 100
                )}%</span>
            </div>
            <div style="font-size: 13px; color: #475569; margin-bottom: 4px;">
                ${edge.source === nodeId ? node.name : targetNode.name} 
                ${direction} 
                ${edge.source === nodeId ? targetNode.name : node.name}
            </div>
            <div style="font-size: 12px; color: #64748b;">${
              edge.relation_desc
            }</div>
        </div>`;
  });

  showModal(
    `${node.name} 的所有关联`,
    `
        <div style="max-height: 400px; overflow-y: auto;">
            <div style="padding: 20px; padding-bottom: 0;">
                <h3 style="margin-bottom: 16px;">${node.name} 的关联 (${relatedEdges.length}条)</h3>
            </div>
            <div style="padding: 0 20px 20px;">
                ${relationsHTML}
            </div>
        </div>
    `
  );
}

function focusOnEdge(sourceId, targetId) {
  const relatedNodeIds = new Set([sourceId, targetId]);

  // 只显示相关的节点
  const relatedNodes = currentNodes.filter((node) =>
    relatedNodeIds.has(node.id)
  );
  const relatedEdges = currentEdges.filter(
    (edge) =>
      (edge.source === sourceId && edge.target === targetId) ||
      (edge.source === targetId && edge.target === sourceId)
  );

  // 临时保存当前状态
  const tempNodes = [...currentNodes];
  const tempEdges = [...currentEdges];

  currentNodes = relatedNodes;
  currentEdges = relatedEdges;

  renderGraph();

  // 3秒后恢复
  setTimeout(() => {
    currentNodes = tempNodes;
    currentEdges = tempEdges;
    renderGraph();
    closeModal();
  }, 3000);
}

// ============== 数据库管理 ==============
async function clearDatabase() {
  const confirmed = confirm(
    "⚠️ 警告：这将清空数据库中的所有数据！\n\n此操作不可撤销，确定继续吗？"
  );

  if (!confirmed) return;

  showLoading("正在清空数据库...");

  try {
    const response = await fetch(`${API_BASE}/api/kg/clear/all`);
    const result = await response.json();

    if (result.status === "success") {
      // 重新加载数据
      await loadData();
      updateStatus("数据库已清空");
    } else {
      updateStatus("清空失败: " + result.msg);
    }
  } catch (error) {
    console.error("清空数据库失败:", error);
    updateStatus("清空失败，请检查后端服务");
  } finally {
    hideLoading();
  }
}

// ============== 导出功能 ==============
function exportAsPNG() {
  if (!chartInstance) return;

  updateStatus("正在导出PNG...");

  html2canvas(document.querySelector(".graph-container"))
    .then((canvas) => {
      const link = document.createElement("a");
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:]/g, "-");
      link.download = `knowledge-graph-${timestamp}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      updateStatus("PNG导出完成");
    })
    .catch((error) => {
      console.error("导出PNG失败:", error);
      updateStatus("导出失败，请重试");
    });
}

function exportGraphData() {
  const data = {
    meta: {
      exported_at: new Date().toISOString(),
      version: "1.0.0",
      node_count: currentNodes.length,
      edge_count: currentEdges.length,
    },
    nodes: currentNodes,
    edges: currentEdges,
  };

  const dataStr = JSON.stringify(data, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, "-");

  link.download = `knowledge-graph-data-${timestamp}.json`;
  link.href = URL.createObjectURL(dataBlob);
  link.click();

  updateStatus("JSON数据导出完成");
}

function shareGraph() {
  const currentState = {
    nodes: currentNodes.map((n) => n.id),
    layout: currentLayout,
    timestamp: Date.now(),
  };

  const stateStr = encodeURIComponent(JSON.stringify(currentState));
  const shareUrl = `${window.location.origin}${window.location.pathname}?state=${stateStr}`;

  showModal(
    "分享图谱",
    `
        <div style="padding: 20px;">
            <h3 style="margin-bottom: 16px;">分享当前图谱</h3>
            <p style="margin-bottom: 16px; color: #475569;">复制以下链接分享给其他人：</p>
            <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
                <input type="text" value="${shareUrl}" readonly 
                       style="width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px; 
                              background: white; color: #334155; font-size: 14px;">
            </div>
            <div style="display: flex; gap: 12px;">
                <button onclick="copyToClipboard('${shareUrl}')" class="btn-small btn-primary">复制链接</button>
                <button onclick="closeModal()" class="btn-small">关闭</button>
            </div>
        </div>
    `
  );
}

function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      updateStatus("链接已复制到剪贴板");
    })
    .catch((err) => {
      console.error("复制失败:", err);
      updateStatus("复制失败，请手动复制");
    });
}

// ============== 辅助功能 ==============
function showModal(title, content) {
  const modal = document.getElementById("modal");
  const modalContent = document.getElementById("modalContent");

  if (!modal || !modalContent) return;

  modalContent.innerHTML = `
        <h2 style="margin-bottom: 16px; color: #1e293b;">${title}</h2>
        ${content}
    `;

  modal.style.display = "flex";
}

function closeModal() {
  const modal = document.getElementById("modal");
  if (modal) {
    modal.style.display = "none";
  }
}

function updateStats() {
  document.getElementById("nodeCount").textContent = currentNodes.length;
  document.getElementById("edgeCount").textContent = currentEdges.length;
  document.getElementById("layoutType").textContent =
    currentLayout === "force" ? "力导向" : "环形";
}

function updateStatus(message) {
  const statusEl = document.getElementById("statusMessage");
  if (statusEl) {
    statusEl.textContent = message;

    // 5秒后清除状态消息
    setTimeout(() => {
      if (statusEl.textContent === message) {
        statusEl.textContent = "就绪 - 点击节点或连线查看详情";
      }
    }, 5000);
  }
}

function showLoading(message) {
  const progressEl = document.getElementById("loadingProgress");
  if (progressEl) {
    progressEl.style.display = "flex";
    progressEl.querySelector("span").textContent = message;
  }
}

function hideLoading() {
  const progressEl = document.getElementById("loadingProgress");
  if (progressEl) {
    progressEl.style.display = "none";
  }
}

function showHelp() {
  showModal(
    "使用帮助",
    `
        <div style="padding: 20px; max-height: 400px; overflow-y: auto;">
            <h3 style="margin-bottom: 16px; color: #1e293b;">如何使用知识图谱系统</h3>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 8px; color: #475569;">🔍 搜索概念</h4>
                <p style="color: #64748b; margin-bottom: 12px;">在顶部搜索框输入概念名称，如"熵"、"神经网络"等。</p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 8px; color: #475569;">🎯 筛选学科</h4>
                <p style="color: #64748b; margin-bottom: 12px;">在左侧面板中选择感兴趣的学科，系统将只显示相关概念。</p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 8px; color: #475569;">🖱️ 交互操作</h4>
                <ul style="color: #64748b; margin-bottom: 12px; padding-left: 20px;">
                    <li>点击节点：查看概念详情</li>
                    <li>点击连线：查看关联详情</li>
                    <li>双击节点：深度探索概念</li>
                    <li>拖拽节点：调整图谱布局</li>
                    <li>鼠标滚轮：缩放图谱</li>
                </ul>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 8px; color: #475569;">📊 视图控制</h4>
                <p style="color: #64748b; margin-bottom: 12px;">使用底部控制按钮可以放大、缩小、复位视图和切换布局。</p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 8px; color: #475569;">💾 导出功能</h4>
                <p style="color: #64748b; margin-bottom: 12px;">支持导出为PNG图片和JSON数据文件。</p>
            </div>
            
            <button onclick="closeModal()" class="btn-small btn-primary">知道了</button>
        </div>
    `
  );
}

function showAbout() {
  showModal(
    "关于系统",
    `
        <div style="padding: 20px;">
            <h3 style="margin-bottom: 16px; color: #1e293b;">跨学科知识图谱可视化系统</h3>
            
            <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); 
                 color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <p style="font-size: 18px; font-weight: 500; margin-bottom: 8px;">探索知识，连接万物</p>
                <p style="opacity: 0.9;">发现概念间的跨学科关联，构建认知新维度</p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 8px; color: #475569;">🎯 系统特性</h4>
                <ul style="color: #64748b; margin-bottom: 12px; padding-left: 20px;">
                    <li>可视化跨学科概念关联</li>
                    <li>支持多维度筛选和搜索</li>
                    <li>交互式图谱探索体验</li>
                    <li>数据导出和分享功能</li>
                    <li>响应式设计，支持多设备</li>
                </ul>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 8px; color: #475569;">🛠️ 技术栈</h4>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
                    <span style="background: #f1f5f9; padding: 4px 12px; border-radius: 20px; font-size: 12px; color: #475569;">HTML5</span>
                    <span style="background: #f1f5f9; padding: 4px 12px; border-radius: 20px; font-size: 12px; color: #475569;">CSS3</span>
                    <span style="background: #f1f5f9; padding: 4px 12px; border-radius: 20px; font-size: 12px; color: #475569;">JavaScript</span>
                    <span style="background: #f1f5f9; padding: 4px 12px; border-radius: 20px; font-size: 12字; color: #475569;">ECharts</span>
                    <span style="background: #f1f5f9; padding: 4px 12px; border-radius: 20px; font-size: 12px; color: #475569;">FastAPI</span>
                    <span style="background: #f1f5f9; padding: 4px 12px; border-radius: 20px; font-size: 12px; color: #475569;">Neo4j</span>
                    <span style="background: #f1f5f9; padding: 4px 12px; border-radius: 20px; font-size: 12px; color: #475569;">Docker</span>
                </div>
            </div>
            
            <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 16px;">
                <p style="font-size: 12px; color: #94a3b8; text-align: center;">
                    版本 1.0.0 • 设计用于跨学科知识探索与可视化<br>
                    © 2024 跨学科知识图谱项目组
                </p>
            </div>
            
            <button onclick="closeModal()" class="btn-small btn-primary">关闭</button>
        </div>
    `
  );
}

function toggleTheme() {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark-mode") ? "dark" : "light"
  );
  updateStatus(
    `切换到${
      document.body.classList.contains("dark-mode") ? "深色" : "浅色"
    }主题`
  );
}

function bindEvents() {
  // 搜索框回车事件
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        searchConcept();
      }
    });
  }

  // 模态框点击外部关闭
  const modal = document.getElementById("modal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  // 加载保存的主题
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
  }
}

// ============== 模拟API调用 ==============
function callAgentAPI(nodeId) {
  const node = currentNodes.find((n) => n.id === nodeId);
  if (!node) return;

  showLoading("智能体正在挖掘关联...");

  // 模拟API调用延迟
  setTimeout(() => {
    // 模拟挖掘到的新关联
    const newEdges = [
      {
        source: nodeId,
        target: "math_3",
        relation_type: "应用",
        relation_desc: `${node.name} 的概念在微积分中有重要应用`,
        confidence: 0.78,
        evidence: "相关学术论文 (Journal of Applied Mathematics, 2023)",
      },
      {
        source: nodeId,
        target: "cs_3",
        relation_type: "启发",
        relation_desc: `${node.name} 的思想对机器学习算法有启发作用`,
        confidence: 0.72,
        evidence: "人工智能研究进展 (NeurIPS 2022)",
      },
    ];

    // 添加新边
    newEdges.forEach((edge) => {
      if (
        !currentEdges.some(
          (e) => e.source === edge.source && e.target === edge.target
        )
      ) {
        currentEdges.push(edge);
      }
    });

    hideLoading();
    renderGraph();

    showModal(
      "智能体挖掘结果",
      `
            <div style="padding: 20px;">
                <h3 style="margin-bottom: 16px;">智能体挖掘完成</h3>
                <p style="margin-bottom: 16px; color: #475569;">
                    为 "<strong>${node.name}</strong>" 挖掘到 <strong>${
        newEdges.length
      }</strong> 条新的跨学科关联：
                </p>
                <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                    ${newEdges
                      .map((edge) => {
                        const targetNode = currentNodes.find(
                          (n) => n.id === edge.target
                        );
                        return `
                        <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e0f2fe;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <strong style="color: #0369a1;">${
                                  edge.relation_type
                                }</strong>
                                <span style="color: ${
                                  edge.confidence > 0.8
                                    ? "#10b981"
                                    : edge.confidence > 0.6
                                    ? "#f59e0b"
                                    : "#ef4444"
                                }">
                                    ${Math.round(edge.confidence * 100)}% 置信度
                                </span>
                            </div>
                            <div style="color: #475569; font-size: 14px;">${
                              node.name
                            } → ${targetNode?.name || "未知概念"}</div>
                            <div style="color: #64748b; font-size: 13px; margin-top: 4px;">${
                              edge.relation_desc
                            }</div>
                            <div style="color: #94a3b8; font-size: 12px; margin-top: 4px;">
                                <em>${edge.evidence}</em>
                            </div>
                        </div>`;
                      })
                      .join("")}
                </div>
                <button onclick="closeModal()" class="btn-small btn-primary">确定</button>
            </div>
        `
    );

    updateStatus(`智能体为 "${node.name}" 挖掘到 ${newEdges.length} 条新关联`);
  }, 2000);
}

// ============== 初始化应用 ==============
// 等待DOM加载完成
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
