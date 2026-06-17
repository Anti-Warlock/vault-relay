# VaultRelay

一个从 Obsidian 生成平台草稿，并通过可选 Companion Pro 填入平台编辑器的本地优先发布工具。

**Your vault stays. Your ideas travel.**

它不会要求你迁移 Vault，也不会替换你的创作工具。文章仍然写在 Obsidian 中，VaultRelay 负责理解 Markdown 结构、生成平台草稿，并把发布前的重复工作尽量自动完成。

## 当前可用能力

- 识别标题、段落、列表、引用、Callout、代码块和表格
- 识别 Obsidian 本地图片与 OSS 远程图片
- 显示发布准备评分和待处理问题
- 在 Obsidian 内生成富文本成品预览
- 将长文章按语义编译为统一排版的图片卡片
- 批量导出 1200×1500 PNG 到当前 Vault
- 为 X、知乎和小红书生成并填入平台草稿
- 为 X Premium 创作者生成 X Article 草稿，保留标题、段落、列表、引用、链接和图片顺序
- 为知乎生成保留标题、列表、引用、代码块与图片顺序的富文本
- 为小红书生成图文笔记；长内容自动切换长文模式，避免截断
- 持久保存四个平台的启用开关，一键 Push 所有已启用平台
- 通过可选 VaultRelay Companion 填入平台编辑器，停在最终发布前
- X Article、知乎、小红书和微信公众号均已接入；公众号自动使用正文首图作为封面
- 全部核心处理在本地完成

## 安装

VaultRelay 由两个组件配合完成一键填入：

- **VaultRelay Obsidian 插件**：读取当前 Markdown，生成平台草稿，启动本机任务交接。
- **VaultRelay Companion 浏览器扩展**：在 Chrome/Edge 中领取任务，把标题、正文和图片填入目标平台编辑器。

只安装 Obsidian 插件时，仍可使用文章检查、成品预览、图片卡片导出、文本复制和富文本复制。要使用“一键 Push / 自动填入平台草稿”，需要同时安装浏览器扩展。

### 安装 Obsidian 插件

在 Obsidian 中打开：

```text
设置 → 第三方插件 → 社区插件市场
```

搜索：

```text
VaultRelay
```

安装并启用插件。

### 安装浏览器扩展

在 Chrome 或 Edge 中打开扩展商店：

```text
Chrome 网上应用店 / Microsoft Edge Add-ons
```

搜索：

```text
VaultRelay Companion
```

安装扩展后，建议把 VaultRelay Companion 固定到浏览器工具栏。使用前请先在浏览器中登录 X、知乎、微信公众号或小红书；VaultRelay 不保存平台密码、Cookie 或验证码。

### 开发者本地安装

```bash
npm install
npm run build
```

将下面三个文件复制到：

```text
你的仓库/.obsidian/plugins/vault-relay/
```

文件：

```text
main.js
manifest.json
styles.css
```

重启 Obsidian，在第三方插件中启用 **VaultRelay**。

## 使用

打开一篇 Markdown 长文，然后使用左侧栏预览按钮，或者命令面板：

```text
VaultRelay: 检查当前文章结构
VaultRelay: 预览当前文章成品
VaultRelay: 生成长文图片卡片
VaultRelay: 生成 X Article 草稿
VaultRelay: 打开平台发布工作室
VaultRelay: 一键 Push 已启用平台
```

## 发布到平台

1. 在 Obsidian 打开文章，运行 `VaultRelay: 打开平台发布工作室`，配置 X、知乎、小红书和微信公众号的平台开关。
2. 以后直接点击左侧栏发送按钮，或运行 `VaultRelay: 一键 Push 已启用平台`。
3. 免费使用“复制文本”或“复制富文本”。
4. 点击“一键创建/填入 · Companion”。首次使用提供 14 天或 20 次完整试用，之后每月仍可免费填入 3 次。
5. VaultRelay 先在本地解析 Obsidian 图片并下载 OSS 图片，再通过仅监听本机 `127.0.0.1` 的临时中继，把任务交给浏览器助手并打开目标编辑器。
6. Companion Pro 自动领取任务、填入内容并检查完整性；失败任务会保留在队列中，可重试或退回剪贴板导入。
7. 浏览器会逐个打开已启用平台。检查填入结果，手动点击各平台的最终发布按钮。

Companion Pro 不会点击最终发布按钮。

如果 Companion 未在 15 秒内领取任务，Obsidian 会自动复制回退任务。扩展弹窗会显示本机中继连接状态。

## 免费与订阅

免费核心插件采用 MIT License，包含：

- Markdown 结构解析和发布检查
- X、知乎和小红书草稿生成
- 文本与富文本复制
- 图片卡片导出

`chrome-extension/` 是单独许可的 Companion。用户需要在 Chrome/Edge 中保持目标平台登录；VaultRelay 不保存平台密码、Cookie 或验证码。

- 自动打开平台编辑器
- 自动填入文字、富文本和图片
- 平台页面变化后的持续适配
- 发布队列、填入状态与失败重试
- 正文编辑器识别、图片数量与可验证顺序检查
- 真实平台页面只读检测与诊断复制
- 发布前平台限制检查与失败诊断

Creator Pro 提供无限平台填入、更长任务历史和持续兼容维护。免费用户使用相同质量的填入能力，只限制每月次数。微信公众号已支持标题、正文、图片和正文首图封面填入。

网页平台需要持续维护，因此不建议永久买断。Creator Pro 当前采用签名离线许可证交付；支付与授权自动化将在验证付费需求后接入。

## 官网与隐私

公开官网、隐私政策和服务条款位于 `site/`，可直接部署到 Cloudflare Pages。

点击“导出全部 PNG”后，图片会写入：

```text
当前文章目录/vault-relay/文章名/
```

## 当前产品边界

- 不自动点击任何平台的最终发布按钮
- 不需要 X API
- X Article 功能需要用户自己的 X Premium、Premium+ 或 Business 账号
- 不上传整个 Vault
- 本机中继仅监听 `127.0.0.1`，不把文章发送到 VaultRelay 服务器
- 每次一键交接使用一次性领取码；领取码位于 URL fragment，不会发送给目标平台服务器
- Companion Pro 当前面向 Chrome/Edge
- 四个平台的网页结构变化都可能影响自动填入，需要持续适配
- 平台网页发生变化时，需要持续适配和验证

## 推广与测试

- 集中测试指南：`docs/final-review.md`
- 真实账号验证指南：`docs/real-account-review.md`
- 真实账号页面观察：`docs/real-account-observations.md`
- 产品计划：`docs/product-plan.md`
- 推广视频：`promo/vault-relay-demo.mp4`
- X 推广帖：`promo/x-launch-post.md`

## 开发验证

```bash
npm test
npm run build
npm run verify
npm run record:promo
```
