# TextIn Resources · 运营操作指南

控制台左侧展开 **Files → README.md**，即可查看本指南。README 不发布到官网；公开仓库中仍可阅读，请勿写入账号、密钥或未公开资料。

## 1. 从哪里修改

| 要做什么 | 打开哪里 | 页面会怎样变化 |
| --- | --- | --- |
| 修改新闻正文 | Navigation → Journal → 对应文章 | 更新新闻详情 |
| 修改客户案例 | Navigation → Customer stories → 对应客户 | 更新案例详情 |
| 修改标题、摘要 | 文章顶部，或 `… → Page settings` | 自动生成后同步到详情和列表卡片 |
| 修改日期、封面、分类、客户信息 | Files → `content/catalog.json` | 自动生成后更新卡片、详情信息栏及筛选项 |
| 新增内容 | New page + 信息表新增一条记录 | 自动生成列表卡片、文章导航及分页 |
| 修改布局、按钮、公共 CTA | 交给开发 | 统一调整站点样式 |

文章写英文；分类、行业、产品和场景沿用现有英文名称。

## 2. 新增一篇内容

1. 打开右上角 **… → Branches**，新建内容分支，例如 `content/new-customer`。新版界面也可从顶部的分支名称进入。
2. 点击 **New page**，填写标题和摘要。
3. 打开 **… → Page settings → Path**，新闻使用 `news/英文短名称`，案例使用 `cases/英文短名称`，例如 `cases/acme-contract-review`。已上线文章保留原路径。
4. 在可视化编辑器编写正文；使用下节模板时，打开 **… → Source mode** 粘贴。
5. 上传封面；有已确认的客户 Logo 时一并上传。记录图片路径。
6. 展开 **Files → content → catalog.json**，在 `news` 或 `cases` 数组中复制一条记录，按第 4 节填写。
7. 按第 6 节提交、预览、审核和发布。

**正文与信息表缺一不可。** 只有正文不会生成列表卡片；只有信息表、没有对应文章或图片，会校验失败。

### 正文模板

以下可直接粘贴到新页面的 Source mode，再替换文字。新闻可将三个章节改为主题对应的小标题。

```mdx
---
title: "How Acme makes contract review traceable"
description: "How Acme connects extracted clauses to their source documents."
keywords:
  - contract analysis
  - xParse
mode: center
hideFooterPagination: true
---

Introduce the customer and the business context.

## The challenge

Describe the problem and its business impact.

## The solution

Explain the workflow and the role of TextIn.

## The results

Describe verified outcomes and supporting evidence.
```

模板中的 Acme 为示例，发布前替换为已确认的客户与事实。

## 3. 编写正文与图片

| 操作 | 呈现结果 | 建议 |
| --- | --- | --- |
| 输入 `/`，选择 Heading 2 | 正文章节与右侧目录 | 正文从二级标题开始，不再重复文章标题 |
| 选择 Heading 3 | 章节内的小标题 | 用于步骤、能力或成果分组 |
| 插入图片或拖入图片 | 在当前位置显示图片 | 正文图片填写简短英文说明；上传前转为 WebP |
| 插入 List、Table | 要点列表、对比表格 | 表格用于参数和比较，长段落使用普通正文 |
| 插入官方 Note、Tip、Warning | 提示框 | 只保留影响读者操作的信息 |
| 插入官方 Steps、Accordion、Tabs | 步骤、折叠区、切换内容 | 有连续步骤或并列内容时再使用 |
| 添加普通链接 | 可点击文字 | 站内链接使用 `/cases/路径` 或 `/news/路径` |

封面建议使用横向图片，重要内容放在中央，列表会裁切边缘。上传到 Files 的 `images/` 下，路径以 `/images/` 开头；封面和 Logo 支持 `.webp`、`.jpg`、`.jpeg`、`.svg`，信息表不接受 `.png`。

**封面、列表 Logo 与正文图片分别维护。** 修改 `cover` 不会替换正文图片；填写 `customerLogo` 只在案例列表客户名称旁显示 Logo。

标题和摘要在文章中维护；`keywords` 在 Page settings 或 Source mode 的页头维护，用于页面 SEO，不会新增筛选项，也不会替代正文。

文章顶部的信息栏、返回列表、底部联系按钮由系统生成。正文只使用 Markdown 和 Mintlify 官方组件，不添加 `<time>`、`<div>`、自定义组件或脚本；不要改动 `content:metadata`、`content:footer` 注释之间的内容。

## 4. 填写列表信息表

### 新闻：在 `news` 数组中新增

```json
{
  "page": "news/your-article",
  "date": "2026-10-23",
  "category": "Guides",
  "product": "xParse",
  "cover": "/images/journal/your-cover.webp",
  "readMinutes": 4,
  "featured": false
}
```

### 案例：在 `cases` 数组中新增

```json
{
  "page": "cases/your-customer-story",
  "date": "2026-10-23",
  "industry": "Software",
  "scenarios": ["Contract analysis", "Knowledge management"],
  "product": "xParse",
  "cover": "/images/cases/your-customer/cover.webp",
  "customer": "Your customer name",
  "customerLogo": "/images/cases/your-customer/logo.webp",
  "metric": {
    "value": "Your verified result",
    "label": "Brief explanation of the result"
  },
  "featured": false
}
```

替换示例路径并先上传对应图片；没有 Logo 时删除整行 `customerLogo`。未公开客户使用已确认的匿名名称，成果必须有事实支撑。

### 字段与展示结果

| 字段或操作 | 呈现结果 |
| --- | --- |
| `page` | 连接对应文章；与 Path 一致，不带开头 `/` 和 `.mdx`，不可重复 |
| `date` | 显示发布日期，参与 Newest first / Oldest first 排序；格式为 `YYYY-MM-DD` |
| `category` / `industry` | 新闻分类 / 案例行业，同时成为列表筛选项 |
| `scenarios` | 案例场景筛选；多个场景写为数组，不使用 `\|` 拼接 |
| `product` | 产品筛选；新闻填单个字符串，案例可填 `["xParse", "DocFlow"]` |
| `customer` / `customerLogo` | 案例卡片突出显示客户名称及可选 Logo；客户名同时用于控制台文章导航 |
| `metric.value` / `metric.label` | 案例卡片展示成果值和说明；两个字段都必填 |
| `readMinutes` | 新闻卡片显示预计阅读分钟数，填大于 0 的整数 |
| `featured: true` | 卡片使用大版式；新闻、案例各最多一条，不会自动移到首位 |
| 调整数组中记录顺序 | 改变默认 Featured 排序；要首位大卡，需同时移到数组第一条并设为 `true` |
| 增加新分类、行业、产品或场景 | 自动增加筛选选项；注意大小写及空格，避免同义项重复 |

JSON 使用英文双引号，记录之间加逗号，最后一条后不加逗号；`true`、`false` 不加引号，不写注释。

## 5. 首页、筛选与分页规则

- 首页 Journal 自动展示 `date` 最新的 3 篇新闻，与数组顺序和 `featured` 无关。
- Journal、Customer stories 均每页 5 条，超过 5 条自动生成分页；筛选、排序覆盖全部记录。
- 列表搜索匹配标题、摘要、分类、产品等卡片信息，案例另含客户、场景与成果；不搜索正文全文。
- 行业、场景、产品和搜索可以组合使用；从详情返回时保留页码与筛选条件。
- 填未来日期只会改变展示和排序，**不会定时发布**。未完成的内容保留在未合并的工作分支。

## 6. 提交、预览与发布

| 步骤 | 操作 | 完成标志 |
| --- | --- | --- |
| 保存到工作分支 | Publish 菜单 → Save in branch；不同版本可能显示提交或创建 PR 入口 | 修改已提交到内容分支，尚未合并到线上分支 |
| 等待自动生成 | GitHub 同一分支 → Actions → Content publishing | `validate` 与 `generate` 成功；如需更新列表，会出现机器人生成提交 |
| 打开完整站点预览 | Publish 菜单的预览链接，或 PR 中 Mintlify 的预览链接 | 最新生成提交对应的预览构建成功 |
| 检查 | 列表 → 筛选 → 详情 → 返回列表 → 底部联系按钮 | 内容、图片、链接与返回状态正确；手机端无溢出 |
| 审核上线 | 创建 PR（合并申请），审核通过后 Merge and publish，或由负责人在 GitHub 合并 | 控制台 Publishes 显示成功，正式网址可见最新内容 |

编辑器自动保存只保存草稿，未必提交到 Git。直接在部署分支点击 Publish 会触发正式站点更新，因此使用内容分支完成生成与审核后再合并。

正文可在编辑器即时查看；信息表改动要等自动生成完成，才会更新完整站点中的列表。Mintlify 构建与 GitHub Actions 分别运行，第一次预览可能尚未包含生成结果。

## 7. 常见修改与问题

| 情况 | 处理方式 |
| --- | --- |
| 只改正文 | 打开对应文章编辑，走同一套提交与审核流程 |
| 换封面、Logo 或分类 | 修改信息表对应字段；换正文图片则在文章中单独修改 |
| 想取消大卡片 | 将对应记录的 `featured` 改为 `false`，或删除该字段 |
| 想从列表撤下 | 从信息表移除该条记录；生成后列表和文章导航消失，原链接仍可访问 |
| 想彻底下线文章 | 移除记录和对应文章文件，清理站内引用；旧网址重定向交给开发 |
| 信息表已改，列表没变 | 确认已提交同一分支，等待 Content publishing 与最新预览构建成功 |
| 找不到 `content/catalog.json` | 展开 Files；仍无此文件时，先由开发确认分支是否已同步本版维护流程 |
| 校验失败 | Actions → Content publishing → validate，按报错修正文章路径、缺失图片、字段或 JSON 格式后重新提交 |
| `generate` 写回失败 | 交给开发检查机器人写权限、分支规则及冲突，再重跑工作流 |
| 提示 `could not be rendered` | 切 Source mode 检查非官方标签；若来自自动生成区域，交给开发处理 |
| 出现合并冲突 | 暂停合并，把分支名交给开发；不要直接覆盖其他人的修改 |

不要直接编辑 `index.mdx`、`cases/list.mdx`、`news/list.mdx` 及其分页文件，自动生成会覆盖这些改动。公共布局、样式、域名与 `siteUrl`、自动流程由开发维护。

## 8. 开发接入与本地验证

首次交付须完成：将本版代码同步到控制台连接的仓库；确认 GitHub Actions 启用、机器人能写回工作分支；用一篇新增内容验证“正文 + 信息表 → 自动生成 → 分支预览 → 审核发布”。在此之前，不把本地预览当成控制台流程已接通。

使用 Node.js 24 LTS：

```sh
npm ci --ignore-scripts
npm run preview
```

本地预览：[localhost:3001](http://localhost:3001)。修改正文或信息表后运行 `npm run content:build`。

开发维护 `templates/`、`style.css`、`cases.js`、`scripts/` 及工作流。生成器同步两组文章导航和分页路径，保留 `docs.json` 其他站点配置；使用 GitHub 自带 `GITHUB_TOKEN`，不需要在内容中添加密钥。

```sh
npm test
npm run content:build
npm run content:check
node --check cases.js
npx --yes mint@4.2.1096 validate
npx --yes mint@4.2.1096 broken-links
```

界面参考：[创建与编辑页面](https://www.mintlify.com/docs/editor/pages)、[分支与发布](https://www.mintlify.com/docs/editor/branching-and-publishing)、[排除文件](https://www.mintlify.com/docs/organize/mintignore)。
