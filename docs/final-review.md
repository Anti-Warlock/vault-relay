# Obsidian Publish Studio 0.6.1 集中测试指南

## 安装检查

1. 覆盖 `main.js`、`manifest.json`、`styles.css`。
2. 重启 Obsidian。
3. 确认插件名称为 `Obsidian Publish Studio`，版本为 `0.6.1`。

## 建议测试文章

准备三篇真实文章：

1. 普通中文长文。
2. 包含本地图片、OSS 图片、代码块和表格的技术文章。
3. 包含引用、Callout、复杂列表和深层标题的 Obsidian 笔记。

## 测试一：文章结构

执行：

```text
Obsidian Publish Studio: 检查当前文章结构
```

检查标题、段落、图片和特殊结构是否正确识别，是否存在错误警告。

## 测试二：发布成品预览

执行：

```text
Obsidian Publish Studio: 预览当前文章成品
```

检查：

- 发布评分是否合理
- 本地与 OSS 图片是否显示
- 表格和代码块是否易读
- 整体效果是否像发布成品

## 测试三：长文图片卡片

执行：

```text
Obsidian Publish Studio: 生成长文图片卡片
```

检查：

- 卡片是否按照文章章节合理拆分
- 是否存在内容截断或明显溢出
- 图片、代码块、表格是否正确
- 点击“导出全部 PNG”是否成功
- 导出的图片是否为 1200×1500
- 输出目录是否在当前 Vault 内

## 测试四：推广材料

查看：

```text
promo/obsidian-publish-studio-demo.mp4
promo/obsidian-publish-studio-poster.png
promo/x-launch-post.md
```

检查视频和文案是否准确表达：

> 用户继续使用自己的 Obsidian Vault，不需要迁移到另一个创作平台。

## 已知限制

- 超长单段可能被标记为“可能过长”，不会静默截断。
- 远程图片若禁止跨域访问，可能无法被导出到图片卡片。
- 当前只有一套图片卡片主题。
- 当前不自动发布到具体平台。

## 反馈格式

请记录：

- 使用的文章类型
- 哪个命令出现问题
- 截图或导出图片
- 预期结果
- 实际结果
