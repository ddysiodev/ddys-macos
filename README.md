# DDYS macOS

DDYS macOS 是低端影视 API 的官方 macOS 桌面端生态包，面向希望在 Mac 上长期打开、集中检索和管理观影内容的用户。

## 功能

- macOS 工作台：发现、搜索、日历、片库、订阅、设置集中在同一个窗口。
- 发现页：聚合最新更新、热门内容和推荐片单。
- 搜索页：支持关键词和类型筛选，并能一键订阅当前关键词。
- 详情侧栏：展示影片信息、在线资源、下载资源、相关内容和本地备注。
- 本地片库：收藏、稍后看、观看历史、备注都保存在当前 Mac。
- 订阅提醒：按关键词检查 DDYS 搜索结果，发现新增内容后发送系统通知。
- 设置中心：API 地址、站点地址、API Key、缓存时间、刷新间隔、通知、主题、打开方式可配置。
- 导入导出：本地数据可以导出为 JSON，也可以从 JSON 恢复。
- 诊断：检查 API 连通性、延迟、样本返回和本地数据数量。
- Tauri v2 macOS 外壳：支持 WKWebView、菜单栏托盘、通知权限、外链打开、`.app` 和 `.dmg` 打包配置。

## 使用

从 GitHub Release 下载适合自己的资源包。若 Release 提供 `.dmg`，打开后把 `DDYS macOS.app` 拖入 Applications 即可；若下载的是源码包，可按 Tauri 官方流程在 Mac 上构建。

首次打开后建议进入“设置”确认 API Base 和站点 Base。默认值：

- API Base: `https://ddys.io/api/v1`
- 站点 Base: `https://ddys.io`

公开读取接口默认不需要 API Key。只有你的 API Base 启用了鉴权，或你要连接需要认证的 DDYS API 能力时，才需要在设置里填写 API Key。

## 数据与隐私

DDYS macOS 不内置账号系统。本地收藏、稍后看、历史、备注、订阅和设置默认保存在当前 Mac，不会主动上传到第三方服务。应用只会在用户执行搜索、刷新、订阅检查、诊断或打开内容时请求配置的 DDYS API / 站点地址；如果设置了 API Key，请求会带上 `Authorization: Bearer`。

详见 [PRIVACY.md](./PRIVACY.md)。

## 官方资料

- Tauri: https://tauri.app/
- Tauri v2 启动文档: https://v2.tauri.app/start/
- Tauri v2 macOS 打包: https://v2.tauri.app/distribute/macos-application-bundle/
- Tauri v2 配置文档: https://v2.tauri.app/reference/config/
