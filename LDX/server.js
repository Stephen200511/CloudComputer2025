const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = 3000;
const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

  // 解析URL
  const parsedUrl = url.parse(req.url);
  let filePath = "." + parsedUrl.pathname;

  // 默认页面
  if (filePath === "./") {
    filePath = "./index.html";
  }

  // 获取文件扩展名
  const extname = path.extname(filePath);
  let contentType = MIME_TYPES[extname] || "application/octet-stream";

  // 读取文件
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        // 文件不存在，返回404
        fs.readFile("./404.html", (err, content) => {
          if (err) {
            res.writeHead(404, { "Content-Type": "text/html" });
            res.end("<h1>404 Not Found</h1>", "utf-8");
          } else {
            res.writeHead(404, { "Content-Type": "text/html" });
            res.end(content, "utf-8");
          }
        });
      } else {
        // 服务器错误
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      // 成功响应
      res.writeHead(200, {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      });
      res.end(content, "utf-8");
    }
  });
});

server.listen(PORT, () => {
  console.log(`
    🚀 知识图谱本地服务器已启动！
    📍 本地访问: http://localhost:${PORT}
    🌐 网络访问: http://${getLocalIP()}:${PORT}
    
    按 Ctrl+C 停止服务器
    `);
});

// 获取本地IP地址
function getLocalIP() {
  const interfaces = require("os").networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

// 优雅关闭
process.on("SIGINT", () => {
  console.log("\n👋 服务器正在关闭...");
  server.close(() => {
    console.log("✅ 服务器已关闭");
    process.exit(0);
  });
});
