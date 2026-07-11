# 架构说明

DDYS macOS 分为三层：

1. 前端工作台
   - `src/main.js` 负责应用状态、事件、视图渲染和用户交互。
   - `src/styles.css` 负责 macOS 桌面布局、响应式检查和主题。

2. 核心模块
   - `src/core/api.js` 封装 DDYS API 请求、超时、缓存和诊断。
   - `src/core/storage.js` 封装本地设置、收藏、稍后看、历史、备注、订阅、缓存、导入导出。
   - `src/core/subscriptions.js` 负责关键词订阅检查、去重、摘要和通知判断。
   - `src/core/normalize.js` 负责不同 API 返回形态的标准化。
   - `src/core/desktop.js` 负责通知、打开外链、主题、导入导出文件等 macOS 辅助能力。

3. Tauri v2 macOS 壳
   - `src-tauri/tauri.conf.json` 配置窗口、CSP、`.app/.dmg` 打包目标和图标。
   - `src-tauri/Entitlements.plist` 声明网络、用户选择文件和 WKWebView JIT 所需能力。
   - `src-tauri/Info.plist` 合并 macOS 应用分类、高分屏和版权信息。
   - `src-tauri/src/lib.rs` 注册菜单栏托盘、通知插件和外链插件。
   - `src-tauri/capabilities/default.json` 声明前端需要的默认权限。

## 本地数据

本地数据使用 `localStorage` 保存；在 Node 测试环境中会降级到内存存储。这样浏览器预览、Tauri WKWebView 和测试都能走同一套接口。

## 缓存策略

GET 请求根据完整 URL 生成缓存键，默认缓存 15 分钟，最多保留 120 条。用户可以在设置页修改缓存时间，也可以手动清理缓存。

## macOS 能力

Tauri v2 在 macOS 上使用系统 WKWebView 承载前端。窗口默认 1400x900，最小 960x680。菜单栏托盘支持“显示 DDYS”和“退出”。通知能力用于订阅提醒，外链能力用于打开影片页面和资源链接。打包目标为 `.app` 和 `.dmg`。

参考：

- https://v2.tauri.app/start/
- https://v2.tauri.app/distribute/macos-application-bundle/
- https://v2.tauri.app/plugin/notification/
- https://v2.tauri.app/plugin/opener/
- https://v2.tauri.app/reference/config/
