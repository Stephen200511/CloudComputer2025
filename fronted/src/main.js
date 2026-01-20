import {
  initGraph,
  renderGraph,
  filterNodesBySubject,
} from "./components/Graph.js";

import { exportGraphAsPNG, exportGraphAsPDF } from "./utils/exportUtils.js";

// 页面加载完成后初始化
window.onload = function () {
  // 初始化图谱
  initGraph();

  // 绑定查询按钮事件
  document.getElementById("queryBtn").addEventListener("click", fetchGraphData);

  // 绑定重置按钮事件
  document.getElementById("resetBtn").addEventListener("click", function () {
    document.getElementById("keywordInput").value = "";
    document.getElementById("subjectFilter").value = "all";
    // 重置图谱（清空）
    d3.select("#graphSvg").selectAll("*").remove();
    document.getElementById("noDataTip").style.display = "none";
    document.getElementById("infoPanel").style.display = "none";
  });

  // 绑定学科筛选事件
  document
    .getElementById("subjectFilter")
    .addEventListener("change", function () {
      const subject = this.value;
      filterNodesBySubject(subject);
    });

  // 绑定图谱导出按钮事件（后续完善，先占位）
  document.getElementById("exportBtn").addEventListener("click", function () {
    // 弹出选择框，让用户选导出格式
    const format = prompt("请选择导出格式：1=PNG，2=PDF", "1");
    if (format === "1") {
      exportGraphAsPNG();
    } else if (format === "2") {
      exportGraphAsPDF();
    } else {
      alert("请输入1或2选择格式！");
    }
  });
  // 绑定重置布局按钮事件
  document
    .getElementById("resetLayoutBtn")
    .addEventListener("click", function () {
      if (simulation) {
        simulation.alpha(0.3).restart(); // 重新启动力导向图，节点自动重新排列
      }
    });
};

// 调用后端接口获取图谱数据（真实接口版本）
function fetchGraphData() {
  const keyword = document.getElementById("keywordInput").value.trim();
  const subject = document.getElementById("subjectFilter").value;

  // 输入校验
  if (!keyword) {
    alert("请输入核心概念词（如：熵、最小二乘法）！");
    return;
  }

  // 显示加载动画
  const graphContainer = document.querySelector(".graph-container");
  const loading = document.createElement("div");
  loading.style.position = "absolute";
  loading.style.top = "50%";
  loading.style.left = "50%";
  loading.style.transform = "translate(-50%, -50%)";
  loading.style.fontSize = "16px";
  loading.style.color = "#4299e1";
  loading.textContent = "正在挖掘跨学科关联...";
  graphContainer.appendChild(loading);

  // 调用后端接口（替换为你们后端的真实地址，比如http://localhost:8000/api/kg/query）
  axios
    .get("http://localhost:8000/api/kg/query", {
      params: { keyword: keyword, subject: subject },
    })
    .then((response) => {
      graphContainer.removeChild(loading);
      const data = response.data;
      // 渲染图谱（真实后端数据）
      renderGraph(data);
    })
    .catch((error) => {
      graphContainer.removeChild(loading);
      console.error("获取图谱数据失败：", error);
      alert("获取数据失败，请检查后端服务是否启动，或联系后端同学！");
    });
}
