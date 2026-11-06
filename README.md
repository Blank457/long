# 云享 CloudShare ☁️

> 基于 **华为云 OBS + FunctionGraph Serverless** 的智能文件协作分享平台 · 华为 ICT 大赛参赛作品

**一键上云，秒级分享** —— 拖拽文件上传至华为云 OBS，生成带提取码与有效期的分享链接，支持多类型在线预览。

## 快速体验

直接用浏览器打开 `index.html` 即可进入**演示模式**（无需任何配置，文件存于浏览器本地）：
- 拖拽文件上传 → 生成分享链接 → 输入提取码 → 在线预览/下载

## 接入真实华为云

详见 [`docs/部署指南.md`](docs/部署指南.md)，核心三步：
1. 创建 OBS 桶
2. 部署 `serverless/sts-token` 函数到 FunctionGraph
3. 在页面「⚙️ 配置」填入桶名与 STS 函数地址

## 文档

- [作品说明](docs/作品说明.md) — 架构、亮点、功能清单
- [部署指南](docs/部署指南.md) — 华为云上线步骤

## 技术栈

前端原生 HTML/CSS/JS · 后端华为云 FunctionGraph(Node.js) · 存储华为云 OBS · 安全 IAM STS 临时凭证 + 预签名 URL
## 开发工具

全程由 [华为云 CodeArts（码道）代码智能体](https://developer.huaweicloud.com/codeartsco.html) 辅助开发，对话式完成需求澄清、架构设计、代码生成与即时预览验证。详见 [作品说明·九](docs/作品说明.md)。