# VaultRelay

一个本地优先的 Obsidian 长内容发布工作台。

**Your vault stays. Your ideas travel.**

它不会要求你迁移 Vault，也不会替换你的创作工具。文章仍然写在 Obsidian 中，VaultRelay 负责理解 Markdown 结构、检查发布问题，并生成可直接使用的发布成品。

## 当前可用能力

- 识别标题、段落、列表、引用、Callout、代码块和表格
- 识别 Obsidian 本地图片与 OSS 远程图片
- 显示发布准备评分和待处理问题
- 在 Obsidian 内生成富文本成品预览
- 将长文章按语义编译为统一排版的图片卡片
- 批量导出 1200×1500 PNG 到当前 Vault
- 全部核心处理在本地完成

## 安装

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
```

点击“导出全部 PNG”后，图片会写入：

```text
当前文章目录/vault-relay/文章名/
```

## 当前产品边界

- 不自动点击任何平台的发布按钮
- 不需要 X API
- 不上传整个 Vault
- 当前主要成品是平台无关的富文本预览和长文图片卡片
- Chrome 扩展属于早期技术验证，不是当前主流程

## 推广与测试

- 集中测试指南：`docs/final-review.md`
- 产品计划：`docs/product-plan.md`
- 推广视频：`promo/vault-relay-demo.mp4`
- X 推广帖：`promo/x-launch-post.md`

## 开发验证

```bash
npm test
npm run build
npm run record:promo
```
