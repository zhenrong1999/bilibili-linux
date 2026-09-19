---
feature: thread-ripper-extension
status: delivered
updated: 2026-08-27
branch: feat/thread-ripper-extension
commits: a294bc7046fabd2f68f09ae74794ecc9f9c38fdb..74fbc6a3d3e08d91bd0d96c2f6b95adddd7a4749
---

# Thread-Ripper Extension Integration

## Report

**What was built** — 将 [Bilibili-thread-ripper](https://github.com/MrTangLuyao/Bilibili-thread-ripper) 0.9.1.3 作为独立 Chrome MV3 扩展集成到 bilibili-linux。扩展源码放在 `res/extensions/thread-ripper/`，构建时复制到 `app/extensions/thread-ripper/`。适配了 Electron 不支持的 API：移除 `chrome.sidePanel`，guard `chrome.action` 和 `chrome.tabs` 调用。`registerExtension()` 同时加载 bilibili 和 thread-ripper 两个扩展。

**Verification** — `pnpm build`（tsc -b && vite build）通过；`eslint src/inject/common/electron-tool.ts` 无错误；全量 lint 的 786 个错误均为已存在的，与本次改动无关。

**Journey log**
- `git worktree add` 被会话安全策略硬拦，退化为 feature 分支方案
- mise 安装 node@22 + pnpm@10 解决工具链缺失（`mise exec -- pnpm ...`）
- Review 发现 M1（loadExtension 无 catch）和 L1（chrome.tabs 未 guard），已修复并重新验证
- 上游 0.9.1.3 的 `early-mask.js`、`mse-player.js`、`bilibili-danmaku.js`、`bilibili-subtitle.js` 不在 content_scripts 中，是上游结构，非集成问题
- Electron 43 已废弃 `session.loadExtension`（新 API 为 `ses.extensions.loadExtension`），本次保持与现有 bilibili 调用一致

## [S1] Problem

海外用户观看 B 站冷门/高码率视频时单连接下载卡顿。[Bilibili-thread-ripper](https://github.com/MrTangLuyao/Bilibili-thread-ripper) 通过多 Range 并发下载解决此问题，但目前只能作为 Chrome 扩展或油猴脚本安装，bilibili-linux 用户无法直接使用。

## [S2] Design

将 thread-ripper 0.9.1.3 作为**独立 Chrome MV3 扩展**加载到 Electron 中，与现有 `bilibili` 扩展并存。

### 集成方式

- 扩展目录：`app/extensions/thread-ripper/`（构建时从 `res/extensions/thread-ripper/` 复制）
- `registerExtension()` 增加第二次 `loadExtension` 调用
- 源码放在 `res/extensions/thread-ripper/`（不走 Vite 构建，thread-ripper 是纯 JS 无打包依赖）

### 需要的适配

| 原始依赖 | Electron 现状 | 处理 |
|----------|--------------|------|
| `chrome.sidePanel` | 不支持 | 从 manifest 移除 `sidePanel` permission 和 `side_panel` 配置 |
| `chrome.action.setBadgeText` | 有限支持 | service worker 中 guard 掉 badge 调用 |
| `chrome.tabs.onUpdated` | 可能不支持 | guard 掉（review L1 修复） |
| `chrome.storage.sync` | 不支持 | 全部改用 `chrome.storage.local` |
| `chrome.runtime.sendMessage` | 支持 | 保留 |
| service worker subtitle fetch | 支持 | 保留（弹幕/字幕代理） |
| `popup/` 侧边栏 | 不需要 | 不复制 |
| `vendor/artplayer` | 0.9.x 不用 | 不复制 |
| `dev/` 测试 | 不需要 | 不复制 |

### 文件清单（res/extensions/thread-ripper/）

```
manifest.json          # 适配后的版本
icons/                 # 原样复制
src/
  range-core.js        # 原样
  cdn-resolver.js      # 原样
  sidx.js              # 原样
  idm-downloader.js    # 原样
  native-mse-player.js # 原样
  runtime-notices.js   # 原样
  page-hook.js         # 原样
  notification-view.js # 原样
  bridge.js            # 原样
  service-worker.js    # 适配：guard sidePanel/action/tabs
  bilibili-danmaku.js  # 原样（上游即未在 content_scripts 中）
  bilibili-subtitle.js # 原样（上游即未在 content_scripts 中）
  early-mask.js        # 原样（上游即未在 content_scripts 中）
  mse-player.js        # 原样（上游即未在 content_scripts 中）
LICENSE
```

### 构建流程变更

`tools/extension.sh` 增加：复制 `res/extensions/thread-ripper` → `app/extensions/thread-ripper`。

### 加载逻辑变更

`src/inject/common/electron-tool.ts` 的 `registerExtension()`：两次 `loadExtension` 调用，均带 `.catch` 处理。

## [S3] Out of Scope

- 侧边栏线程/速度统计 UI（后续可加到现有设置面板）
- 油猴脚本版本
- thread-ripper 上游版本自动更新机制
- 与 bilibili-linux 现有设置 UI 的深度整合

## Tasks

- [x] T1: 下载 thread-ripper 0.9.1.3 源码并复制到 `res/extensions/thread-ripper/` — acceptance: 目录包含 manifest.json、icons/、src/ 全部 14 个 JS 文件和 LICENSE (covers: S2)
- [x] T2: 适配 manifest.json — 移除 sidePanel permission、side_panel 配置 — acceptance: manifest 无 sidePanel 相关字段 (covers: S2; depends: T1)
- [x] T3: 适配 service-worker.js — guard `chrome.sidePanel`、`chrome.action`、`chrome.tabs` 调用，保留字幕/弹幕代理逻辑 — acceptance: 代码中相关调用有 exists 检查 (covers: S2; depends: T1)
- [x] T4: 修改 `tools/extension.sh` — 复制 thread-ripper 到 app/extensions/ — acceptance: 脚本包含复制逻辑 (covers: S2)
- [x] T5: 修改 `registerExtension()` 加载第二个扩展 — acceptance: 代码中 loadExtension 调用两次，均带 .catch (covers: S2)
- [x] T6: 验证 `pnpm build` 通过 + lint 无新增错误 — acceptance: tsc -b && vite build 成功, eslint 无新错误 (covers: S2; depends: T1-T5)
