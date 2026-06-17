# VaultRelay

VaultRelay 是一个 Obsidian 发布辅助插件。

它可以把当前 Markdown 文章整理成平台草稿，并配合浏览器扩展 VaultRelay Companion，把标题、正文和图片填入 X、知乎、微信公众号和小红书的编辑器。

最终发布仍然由你手动点击。VaultRelay 不保存平台账号、密码、Cookie 或验证码。

## 它能做什么

- 读取当前 Obsidian Markdown 文章。
- 识别标题、段落、列表、引用、代码块、表格和图片。
- 生成文章预览和发布检查结果。
- 导出长文图片卡片。
- 为 X Article、知乎、微信公众号和小红书生成草稿。
- 通过 VaultRelay Companion 自动填入平台编辑器。
- 一键推送到已启用的平台。
- 平台编辑器打开后，停在发布前，由用户检查并手动发布。

## 需要安装什么

VaultRelay 分成两个部分：

- Obsidian 插件：负责读取文章、生成草稿、发起推送。
- VaultRelay Companion 浏览器扩展：负责在 Chrome 或 Edge 中填入平台编辑器。

只安装 Obsidian 插件，也可以使用检查、预览、导出和复制功能。

如果要使用自动填入 X、知乎、公众号或小红书，需要同时安装 VaultRelay Companion。

## 安装 Obsidian 插件

在 Obsidian 中打开：

```text
设置 → 第三方插件 → 社区插件市场
```

搜索：

```text
VaultRelay
```

安装并启用。

## 安装浏览器扩展

在 Chrome 网上应用店或 Microsoft Edge Add-ons 中搜索：

```text
VaultRelay Companion
```

安装后建议固定到浏览器工具栏。

使用前，请先在浏览器中登录你要发布的平台账号。

## 怎么用

1. 在 Obsidian 打开一篇文章。
2. 运行命令 `VaultRelay: 打开平台发布工作室`。
3. 选择要推送的平台。
4. 点击对应平台的推送按钮，或运行 `VaultRelay: 一键 Push 已启用平台`。
5. 浏览器会打开目标平台编辑器，Companion 会自动填入标题、正文和图片。
6. 检查草稿内容。
7. 确认无误后，手动点击平台的发布按钮。

常用命令：

```text
VaultRelay: 检查当前文章结构
VaultRelay: 预览当前文章成品
VaultRelay: 生成长文图片卡片
VaultRelay: 打开平台发布工作室
VaultRelay: 一键 Push 已启用平台
```

## 免费和付费

免费版可以使用：

- 文章结构检查
- 成品预览
- 图片卡片导出
- 文本复制
- 富文本复制
- 每月 3 次浏览器一键填入

Creator Pro 可以使用：

- 无限次一键填入
- 四个平台持续适配
- 图片自动填入
- 失败任务重试
- 更长任务记录

价格以官网和 VaultRelay Companion 扩展中显示为准。

## 隐私边界

- 不上传整个 Vault。
- 不保存平台账号、密码、Cookie 或验证码。
- 本机中继只监听 `127.0.0.1`。
- 一键交接使用一次性领取码。
- 领取码放在 URL fragment 中，不会发送给平台服务器。
- 不自动点击任何平台的最终发布按钮。

## 本地开发

```bash
npm install
npm run build
npm run verify
```

构建后的 Obsidian 插件文件：

```text
main.js
manifest.json
styles.css
```
