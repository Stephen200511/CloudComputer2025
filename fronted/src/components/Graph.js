import { parseGraphData } from "../utils/dataParser.js";

// 全局变量：存储图谱实例和数据
let svg, simulation, nodes, links;

// 初始化图谱
export function initGraph() {
  // 获取SVG容器
  svg = d3.select("#graphSvg");

  // 清空之前的图谱（避免重复渲染）
  svg.selectAll("*").remove();

  // 初始化力导向图模拟
  simulation = d3
    .forceSimulation()
    .force(
      "link",
      d3
        .forceLink()
        .id((d) => d.id)
        .distance(120)
    ) // 增大边距（100→120）
    .force("charge", d3.forceManyBody().strength(-500)) // 增强排斥力（-300→-500，避免拥挤）
    .force(
      "center",
      d3.forceCenter(svg.attr("width") / 2, svg.attr("height") / 2)
    )
    .force("collision", d3.forceCollide().radius(60)) // 增大碰撞半径（50→60，防止节点重叠）
    .force("x", d3.forceX().strength(0.1)) // 轻微向水平方向分散
    .force("y", d3.forceY().strength(0.1)); // 轻微向垂直方向分散
}

// 渲染图谱（接收解析后的数据）
export function renderGraph(rawData) {
  // 解析数据
  const {
    nodes: parsedNodes,
    links: parsedLinks,
    recommend,
  } = parseGraphData(rawData);
  nodes = parsedNodes;
  links = parsedLinks;

  // 隐藏无数据提示
  document.getElementById("noDataTip").style.display = "none";

  // 渲染边
  const link = svg
    .append("g")
    .selectAll("line")
    .data(parsedLinks)
    .enter()
    .append("line")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .attr("stroke-width", 2)
    .on("mouseover", function () {
      d3.select(this)
        .transition()
        .duration(300)
        .attr("stroke", "#4299e1") // 变蓝色
        .attr("stroke-width", 4) // 变粗
        .attr("stroke-opacity", 0.8);
    })
    .on("mouseout", function () {
      d3.select(this)
        .transition()
        .duration(300)
        .attr("stroke", "#999")
        .attr("stroke-width", 2)
        .attr("stroke-opacity", 0.6);
    });

  // 渲染节点（包含文字）
  const node = svg
    .append("g")
    .selectAll(".node")
    .data(parsedNodes)
    .enter()
    .append("g")
    .attr("class", "node")
    .call(
      d3
        .drag() // 拖拽交互
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
    );

  // 节点圆形（替换原来的node.append("circle")部分）
  node
    .append("circle")
    .attr("r", 20)
    .attr("fill", (d) => d.color)
    .attr("stroke", "#fff") // 白色边框
    .attr("stroke-width", 2) // 边框宽度
    .attr("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.2))") // 阴影效果
    .on("mouseover", function () {
      d3.select(this).transition().duration(300).attr("r", 25); // hover放大
    })
    .on("mouseout", function () {
      d3.select(this).transition().duration(300).attr("r", 20); // 离开恢复
    });

  // 节点文字
  node
    .append("text")
    .attr("dx", 25)
    .attr("dy", ".35em")
    .text((d) => d.name)
    .style("font-size", "12px")
    .style("fill", "#333");

  // 节点hover事件（显示关联说明面板）
  node
    .on("mouseover", function (event, d) {
      // 找到当前节点相关的边
      const relatedLinks = links.filter(
        (link) => link.source.id === d.id || link.target.id === d.id
      );
      if (relatedLinks.length > 0) {
        const link = relatedLinks[0];
        const targetNode = link.source.id === d.id ? link.target : link.source;
        // 填充说明面板
        document.getElementById("conceptA").textContent =
          d.name + "（" + d.subject + "）";
        document.getElementById("conceptB").textContent =
          targetNode.name + "（" + targetNode.subject + "）";
        document.getElementById("relationType").textContent = link.type;
        document.getElementById("relationBasis").textContent = link.basis;
        // 显示面板
        document.getElementById("infoPanel").style.display = "block";
      }
    })
    .on("mouseout", function () {
      // 隐藏面板
      document.getElementById("infoPanel").style.display = "none";
    });

  // 节点hover事件下面，新增点击事件
  node.on("click", function (event, d) {
    // 创建弹窗
    const modal = document.createElement("div");
    modal.style.position = "fixed";
    modal.style.top = "50%";
    modal.style.left = "50%";
    modal.style.transform = "translate(-50%, -50%)";
    modal.style.width = "400px";
    modal.style.padding = "20px";
    modal.style.backgroundColor = "white";
    modal.style.borderRadius = "8px";
    modal.style.boxShadow = "0 4px 20px rgba(0,0,0,0.2)";
    modal.style.zIndex = "1000";
    modal.style.fontSize = "14px";

    // 弹窗内容（概念名称、学科、描述）
    modal.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="color: ${d.color}; margin: 0;">${d.name}</h3>
        <span style="color: #999; background: #f5f5f5; padding: 2px 8px; border-radius: 12px;">${
          d.subject
        }</span>
      </div>
      <p style="color: #666; line-height: 1.6; margin-bottom: 15px;">${
        d.desc || "暂无详细描述"
      }</p>
      <button style="width: 100%; background: #4299e1; padding: 8px 0; border: none; border-radius: 4px; color: white; cursor: pointer;">关闭</button>
    `;

    // 添加弹窗到页面
    document.body.appendChild(modal);

    // 关闭弹窗
    modal.querySelector("button").addEventListener("click", function () {
      document.body.removeChild(modal);
    });

    // 点击弹窗外部关闭
    modal.addEventListener("click", function (e) {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  });

  // 图谱缩放交互
  const zoom = d3
    .zoom()
    .scaleExtent([0.3, 3]) // 缩放范围（最小0.3倍，最大3倍）
    .on("zoom", (event) => {
      svg.selectAll("g").attr("transform", event.transform);
    });

  svg.call(zoom);

  // 更新力导向图模拟
  simulation.nodes(nodes).on("tick", ticked);

  simulation.force("link").links(links);

  // 每次模拟迭代时更新节点和边的位置
  function ticked() {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  }

  // 拖拽相关函数
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null; // 释放固定位置，让节点继续参与力模拟
    d.fy = null;
  }

  // 无关联时显示提示
  if (nodes.length <= 1 && links.length === 0) {
    document.getElementById(
      "noDataTip"
    ).innerHTML = `暂无跨学科关联，推荐相关基础概念：<br/>${recommend.join(
      "、"
    )}`;
    document.getElementById("noDataTip").style.display = "block";
  }
  if (nodes.length > 8) {
    simulation.force("charge", d3.forceManyBody().strength(-800)); // 更多节点→更强排斥力
    simulation.force(
      "link",
      d3
        .forceLink()
        .id((d) => d.id)
        .distance(150)
    ); // 更长边距
  }
}

// 按学科筛选节点
export function filterNodesBySubject(subject) {
  if (!nodes || !links) return;

  // 所有学科：显示所有节点和边
  if (subject === "all") {
    svg.selectAll(".node").style("opacity", 1);
    svg.selectAll("line").style("opacity", 0.6);
    return;
  }

  // 筛选目标节点（当前学科 + 关联学科的节点）
  const targetNodeIds = new Set();
  nodes.forEach((node) => {
    if (node.subject === subject) {
      targetNodeIds.add(node.id);
      // 找到该节点的所有关联节点，也需要显示
      links.forEach((link) => {
        if (link.source.id === node.id) targetNodeIds.add(link.target.id);
        if (link.target.id === node.id) targetNodeIds.add(link.source.id);
      });
    }
  });

  // 更新节点显示（目标节点显示，其他隐藏）
  svg
    .selectAll(".node")
    .style("opacity", (d) => (targetNodeIds.has(d.id) ? 1 : 0.1));

  // 更新边显示（连接目标节点的边显示，其他隐藏）
  svg
    .selectAll("line")
    .style("opacity", (d) =>
      targetNodeIds.has(d.source.id) && targetNodeIds.has(d.target.id)
        ? 0.6
        : 0.1
    );
}
