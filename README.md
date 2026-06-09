# Kaoyan Math Bank

Kaoyan Math Bank is a local desktop question bank for organizing Chinese postgraduate math practice. It keeps the data in ordinary folders on your own machine, and each item is split into three LaTeX snippets: question, solution, and notes. You can edit, preview, reorder, select, and export them without turning every small note into a full LaTeX document.

Kaoyan Math Bank 是一个本地桌面题库，用来整理考研数学刷题时积累的题目、解析和备注。数据保存在你自己电脑上的普通文件夹里，每道题分成题目、解析、备注三个 LaTeX 正文片段，编辑时可以实时预览，整理好之后也可以直接导出 `.tex` 和 `.pdf`。

![Main workspace](docs/screenshots/main.png)

![First launch setup](docs/screenshots/setup.png)

## Features / 功能

- Write question, solution, and note content as LaTeX body snippets, while shared packages and macros stay in one global preamble.
- Preview text, formulas, and uploaded images while editing. When the preview is not enough, use “检查当前题” to run a real XeLaTeX compile.
- Select any set of items and export either questions only or the full question-solution-note version as both `.tex` and `.pdf`.
- Export in the current order, or shuffle with a seed so the same random order can be reproduced later.
- Reorder items by dragging, by arrow buttons, or by moving one item directly to item `N`.
- Use multiple local workspaces. Each workspace has its own `bank.json`, images, temporary compile files, and exports.
- Create, open, reveal, reorder, and delete workspaces from the sidebar.

- 题目、解析、备注只写 LaTeX 正文片段，公共宏包和宏命令统一放在全局导言区。
- 编辑时能预览文字、公式和上传图片；遇到实时预览覆盖不了的内容，可以用“检查当前题”跑一次真实 XeLaTeX 编译。
- 勾选任意题目后，可以导出“仅题目版”和“题目、解析、备注完整版”，并同时得到 `.tex` 和 `.pdf`。
- 导出时可以按当前顺序，也可以用种子生成可复现的随机顺序。
- 题序可以拖拽调整，也可以用上下按钮，或者直接把某一题移动到第 `N` 题。
- 支持多个本地工作区。每个工作区单独保存 `bank.json`、图片、临时编译文件和导出文件。
- 侧栏里可以新建、打开、显示、排序和删除工作区。

## Requirements / 依赖

PDF export uses your own TeX installation. The app does not bundle TeX, mainly because TeX distributions are large and very different across systems.

PDF 导出依赖你电脑上的 TeX 环境。软件本身不内置 TeX，主要是因为 TeX 发行版体积很大，而且不同系统的维护方式差别不小。

- macOS: install [MacTeX](https://www.tug.org/mactex/), or another TeX Live setup that provides `latexmk` and `xelatex`.
- Windows: install [TeX Live](https://www.tug.org/texlive/) or [MiKTeX](https://miktex.org/) with `latexmk` and `xelatex`.
- Linux: install TeX Live packages that provide `latexmk`, `xelatex`, `ctex`, `amsmath`, `mathtools`, `tikz`, and `pgfplots`.

Kaoyan Math Bank tries to find `latexmk` from `PATH` and common install locations. If it cannot find TeX automatically, open the global LaTeX panel and set the `latexmk` path by hand.

软件会从 `PATH` 和常见安装位置自动寻找 `latexmk`。如果没有识别出来，可以打开“全局 LaTeX”面板，手动填写 `latexmk` 的路径。

## Install / 安装

When release files are available, download the installer from GitHub Releases:

发布安装包后，可以在 GitHub Releases 下载：

- macOS: `.dmg`
- Windows: NSIS `.exe`

Early builds may be unsigned. macOS and Windows can therefore show security prompts when you open the app. That is normal for an early open-source project without paid code-signing certificates.

早期安装包可能没有签名，所以 macOS 和 Windows 打开时可能会出现安全提示。这是早期开源项目没有付费签名证书时常见的情况。

## Quick Start / 快速上手

1. Install a TeX distribution first.
2. Open Kaoyan Math Bank.
3. On first launch, choose where to create the sample workspace, or open an existing workspace.
4. Add or edit items from the left sidebar.
5. Write LaTeX snippets in the question, solution, and note editors.
6. Click “检查当前题” when you want to verify that the current item can really compile.
7. Select the items you need, choose the export name and order, then export from the bottom-right corner.

1. 先安装 TeX 发行版。
2. 打开 Kaoyan Math Bank。
3. 首次启动时，选择示例工作区放在哪里，或者直接打开已有工作区。
4. 在左侧列表新增或编辑题目。
5. 在题目、解析、备注编辑器中写 LaTeX 正文片段。
6. 需要确认当前题能否真实编译时，点击“检查当前题”。
7. 勾选要导出的题目，设置导出名和导出顺序，然后从右下角导出。

## LaTeX Input Contract / LaTeX 输入规范

Each editor should contain body content only. In other words, write the part that would normally go inside `\begin{document}` and `\end{document}`, not the whole document.

每个编辑器里只写正文内容。换句话说，写正常 LaTeX 文档中放在 `\begin{document}` 和 `\end{document}` 之间的部分，不要把整份文档塞进某一道题。

Good:

```tex
求极限 $\displaystyle \lim_{x\to 0}\frac{\sin x}{x}$。

\[
\lim_{x\to 0}\frac{\sin x}{x}=1.
\]
```

Avoid:

```tex
\documentclass{article}
\begin{document}
...
\end{document}
```

Put shared packages and macros in the global LaTeX preamble. During export, the app wraps selected snippets into `ctexart` documents and compiles them with `latexmk -xelatex`.

公共宏包和宏命令放到“全局 LaTeX”的导言区。导出时，软件会把勾选题目的正文片段统一包装成 `ctexart` 文档，再通过 `latexmk -xelatex` 编译。

TikZ and pgfplots snippets are supported in final PDF compilation. The live preview focuses on MathJax-renderable formulas, so diagrams and package-heavy snippets should still be checked with real compilation.

TikZ 和 pgfplots 片段可以在最终 PDF 编译中使用。实时预览主要覆盖 MathJax 能渲染的公式，图形和依赖宏包较多的内容仍建议用真实编译确认。

## Export / 导出

Selected items export to a folder under the current workspace:

勾选题目会导出到当前工作区的 `exports/` 下面：

```text
My Bank/
  bank.json
  assets/
  exports/
    math-2026-06-08/
      questions.tex
      questions.pdf
      full.tex
      full.pdf
  .tmp/
```

`questions.*` contains only the question modules. `full.*` contains question, solution, and note modules.

`questions.*` 只包含题目模块。`full.*` 包含题目、解析、备注三个模块。

When you export with a random seed, the same seed and selection produce the same shuffled order. Exported items are numbered from `1` in the exported order, while the original source number is kept when the item has one.

使用随机种子导出时，同一组题目和同一个种子会得到同样的乱序结果。导出文件会按导出顺序从 `1` 重新编号，同时尽量保留题目原本的编号或来源信息。

## Workspace Data / 工作区数据

A workspace is just a normal folder:

工作区就是一个普通文件夹：

```text
My Bank/
  bank.json       # question data / 题库数据
  assets/         # uploaded images / 上传图片
  exports/        # exported tex/pdf files / 导出文件
  .tmp/           # temporary compile files / 临时编译文件
```

This layout makes the data easy to back up, move, or manage with your own sync tool. If you like version control, you can also put a personal workspace under Git. The app itself stores recent workspace paths and the optional TeX path override in `app-state.json` inside the application data directory.

这种结构比较方便备份、迁移，也可以放进你自己的同步盘。如果你习惯用 Git 管理个人资料，也可以把自己的工作区单独纳入版本控制。软件本身会在应用数据目录里的 `app-state.json` 中记录最近工作区和可选的 TeX 路径覆盖。

Current workspaces use `bank.json` schema `version: 2`, where the question, solution, and note snippets live under `modules.question.tex`, `modules.solution.tex`, and `modules.note.tex`. Older `version: 1` workspaces with `questionTex`, `solutionTex`, and `noteTex` are still readable and are normalized in memory. To rewrite an older workspace explicitly while keeping a `.bak` backup, run:

当前工作区使用 `bank.json` 的 `version: 2` 结构，题目、解析、备注分别保存在 `modules.question.tex`、`modules.solution.tex`、`modules.note.tex`。旧版 `version: 1` 工作区中的 `questionTex`、`solutionTex`、`noteTex` 仍然可以读取，并会在内存中归一化。若要显式把旧工作区写成新版并保留 `.bak` 备份，可以运行：

```bash
npm run migrate:v2 -- "/path/to/workspace"
```

Preview the migration without writing:

只预览迁移结果、不写入文件：

```bash
npm run migrate:v2 -- "/path/to/workspace" --dry-run
```

Workspace actions are intentionally explicit. The first sample workspace is not created silently; the app asks you where to put it. Later, the sidebar lets you create or open workspaces, move recent workspaces up and down, reveal a workspace in Finder or File Explorer, and delete one after confirmation. “Create” makes a new workspace folder with `bank.json`, `assets/`, `exports/`, and `.tmp/`; “Open” expects an existing workspace folder that already contains `bank.json`. In the desktop app, deleting a workspace moves the folder to the system Trash or Recycle Bin.

工作区操作会尽量让用户知道自己在改哪里。第一次创建示例工作区时，软件不会偷偷选位置，而是会先询问你放在哪里。之后可以在侧栏中新建或打开工作区，对最近工作区上下排序，在 Finder 或文件管理器中显示工作区，也可以确认后删除工作区。“新建”会创建一个包含 `bank.json`、`assets/`、`exports/`、`.tmp/` 的新工作区；“打开”用于选择已经包含 `bank.json` 的已有工作区。桌面版删除工作区时，会把文件夹移入系统废纸篓或回收站。

To migrate an older prototype project that stores its bank at `data/bank.json`, run:

如果要迁移旧原型项目中位于 `data/bank.json` 的题库，可以运行：

```bash
npm run migrate:legacy -- /path/to/old/project "/path/to/new/workspace"
```

## Development / 开发

Install dependencies:

```bash
npm install
```

Run the browser development server:

```bash
npm run dev
```

Run the Electron desktop app in development:

```bash
npm run desktop:dev
```

Build and verify:

```bash
npm run verify
```

`npm run verify` builds the frontend and desktop/server output, runs unit tests, and checks sample LaTeX export compilation when TeX is available on the machine.

`npm run verify` 会构建前端和桌面/服务端产物，运行单元测试，并在本机 TeX 可用时检查示例 LaTeX 导出能否编译为 PDF。

## Packaging / 打包

Build all distributable targets supported on the current platform:

```bash
npm run dist
```

Build macOS DMG:

```bash
npm run dist:mac
```

Build Windows NSIS installer:

```bash
npm run dist:win
```

Packaging still follows platform limits. macOS DMG builds should be made on macOS. Windows installers are best built on Windows, or by a Windows CI runner.

打包仍然受平台限制。macOS 的 DMG 最好在 macOS 上构建；Windows 安装包最好在 Windows 上构建，或者交给 Windows CI runner。

### GitHub Actions Release / GitHub Actions 发布

This repository includes `.github/workflows/release.yml` for release builds. If you do not have a Windows computer, use GitHub-hosted runners:

本仓库包含 `.github/workflows/release.yml` 发布构建工作流。如果你没有 Windows 电脑，可以用 GitHub 托管 runner：

1. Push the repository to GitHub.
2. Open **Actions** > **Build Release Installers** > **Run workflow**.
3. Download the `windows-installer` artifact after the workflow finishes. It contains the Windows NSIS `.exe`.
4. Download the `macos-dmg` artifact if you also want a CI-built macOS DMG.
5. To create a draft GitHub Release automatically, push a tag such as `v0.1.0`.

1. 将仓库推送到 GitHub。
2. 打开 **Actions** > **Build Release Installers** > **Run workflow**。
3. 工作流完成后下载 `windows-installer` artifact，里面包含 Windows NSIS `.exe`。
4. 如果也需要 CI 构建的 macOS DMG，可以下载 `macos-dmg` artifact。
5. 如果想自动创建 GitHub Release 草稿，推送类似 `v0.1.0` 的 tag。

The CI workflow runs build checks and unit tests on Windows before packaging. It is still worth testing the installer on a real Windows machine or VM before a public release, but this workflow gives you a practical release candidate even if you only develop on macOS.

CI 会先在 Windows 上运行构建检查和单元测试，然后再打包。公开发布前最好仍然在真实 Windows 电脑或虚拟机里打开安装包试一次；但如果你平时只有 macOS，这个流程已经能生成一个比较实用的发布候选版本。

## FAQ / 常见问题

### macOS says the app is damaged. What should I do? / macOS 提示软件“已损坏”怎么办？

Early macOS builds are unsigned and not notarized. If you download the DMG through Chrome or another browser, macOS may quarantine the app and show a scary “damaged” message. If you downloaded the app from this repository and trust the build, move it to Applications, then run:

早期 macOS 版本没有签名和公证。如果通过 Chrome 或其他浏览器下载 DMG，macOS 可能会给 app 加上隔离标记，并提示“已损坏”。如果你确认安装包来自本仓库，并且信任这个构建，可以先把 app 拖到“应用程序”，再运行：

```bash
xattr -dr com.apple.quarantine "/Applications/Kaoyan Math Bank.app"
open "/Applications/Kaoyan Math Bank.app"
```

For a public release that ordinary users can open without this step, the macOS build needs Apple Developer ID signing and notarization.

如果希望普通用户下载后不需要这一步，macOS 版本需要使用 Apple Developer ID 做签名和公证。

### Why not bundle TeX? / 为什么不内置 TeX？

TeX distributions are big, system-specific, and not fun to maintain inside another installer. For the first release, Kaoyan Math Bank stays small and uses the TeX environment that users already install for their own study or writing.

TeX 发行版体积大，不同系统的安装和维护方式也不一样。首版先保持软件本体轻量，直接使用用户电脑里已有的 TeX 环境。

### Can I put real exam or textbook questions in the public repo? / 能把真题或教辅题库提交到公开仓库吗？

Please do not commit copyrighted exam-prep books, scanned material, or proprietary question sets unless you have redistribution rights. The repository is meant to contain app code, empty data, and self-authored examples only.

请不要把没有授权的教辅内容、扫描材料或专有题库提交到公开仓库。这个仓库只应该放应用代码、空数据和自造示例题。

### Does the app sync data to the cloud? / 软件会云同步吗？

No. The first release is local-first. You can put a workspace folder in your own sync drive if that fits your workflow, but sync conflicts are then your responsibility.

不会。首版是本地优先。你可以按自己的习惯把工作区放进同步盘，但同步冲突需要自己处理。

## License / 许可证

MIT
