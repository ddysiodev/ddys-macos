# 自动构建说明

`build-macos.yml` 会在 GitHub Actions 的 macOS runner 上构建 `.app` 和 `.dmg`。

## 触发方式

- 手动触发：Actions -> Build macOS app and DMG -> Run workflow，输入 Release tag，例如 `v0.1.0`。
- Tag 触发：推送 `v*` tag 后自动构建并上传到对应 Release。

## 构建内容

- 安装 Node.js、pnpm、Rust stable。
- 分别构建 `aarch64-apple-darwin` 和 `x86_64-apple-darwin`。
- 运行 `pnpm run test`，包含源码自检和单测。
- 使用 `tauri-apps/tauri-action@v1` 调用 `pnpm tauri build --target ...`。
- 按 `tauri.conf.json` 的 `app` 和 `dmg` 目标生成 macOS 产物。
- 自动上传到 GitHub Release，并保留 workflow artifact。

## 签名状态

当前使用 ad-hoc signing identity `-`，适合无 Apple Developer 证书时生成可测试的 macOS 包。若要发布给普通用户，建议配置 Apple Developer ID、hardened runtime 和 notarization。

参考：

- https://v2.tauri.app/distribute/pipelines/github/
- https://v2.tauri.app/distribute/sign/macos/
- https://github.com/tauri-apps/tauri-action
