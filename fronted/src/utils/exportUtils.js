import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// 导出图谱为PNG
export function exportGraphAsPNG() {
  const graphContainer = document.querySelector(".graph-container");
  const loading = document.createElement("div");
  loading.style.position = "absolute";
  loading.style.top = "50%";
  loading.style.left = "50%";
  loading.style.transform = "translate(-50%, -50%)";
  loading.style.fontSize = "16px";
  loading.style.color = "#4299e1";
  loading.textContent = "导出中...";
  graphContainer.appendChild(loading);

  // 用html2canvas捕获图谱容器
  html2canvas(graphContainer, {
    scale: 2, // 高清导出（缩放2倍）
    useCORS: true,
    logging: false,
  })
    .then((canvas) => {
      graphContainer.removeChild(loading);
      // 创建下载链接
      const link = document.createElement("a");
      link.download = `跨学科知识图谱_${new Date().getTime()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    })
    .catch((error) => {
      graphContainer.removeChild(loading);
      alert("PNG导出失败：" + error.message);
    });
}

// 导出图谱为PDF
export function exportGraphAsPDF() {
  const graphContainer = document.querySelector(".graph-container");
  const loading = document.createElement("div");
  loading.style.position = "absolute";
  loading.style.top = "50%";
  loading.style.left = "50%";
  loading.style.transform = "translate(-50%, -50%)";
  loading.style.fontSize = "16px";
  loading.style.color = "#4299e1";
  loading.textContent = "导出中...";
  graphContainer.appendChild(loading);

  html2canvas(graphContainer, {
    scale: 2,
    useCORS: true,
    logging: false,
  })
    .then((canvas) => {
      graphContainer.removeChild(loading);
      // 创建PDF（A4尺寸）
      const pdf = new jsPDF("landscape", "mm", "a4");
      const imgWidth = 280; // A4横向宽度
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      // 添加图片到PDF
      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        10,
        10,
        imgWidth,
        imgHeight
      );
      // 下载PDF
      pdf.save(`跨学科知识图谱_${new Date().getTime()}.pdf`);
    })
    .catch((error) => {
      graphContainer.removeChild(loading);
      alert("PDF导出失败：" + error.message);
    });
}
