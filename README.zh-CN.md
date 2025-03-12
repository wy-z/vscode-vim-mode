# vscode-vim-mode

`vscode-vim-mode` 是一个 Visual Studio Code 扩展，提供 Vim 模式。通过这个扩展，用户可以在 VS Code 中使用 Vim 或 Neovim 进行编辑。

```
🌟 在 VSCode 中使用完整的 Vim 功能，且能无缝切换
🌟 适合重度 Vim 用户，又想充分享用 VSCode 的生态（比如：Copilot）的你（我）
🌟 应该是最简单明了的 VSCode & Vim 集成插件
🌟 能利用双方的生态，且避免了冲突，满足`既要又要`
🌟 可以和其他 Vim 模拟插件配合使用，无冲突 (比如: VSCodeVim、VSCodeNeovim)
```

## 功能

- 在 VS Code 中切换 Vim 模式，并保持编辑状态
- 支持 Vim 和 Neovim
- 同步保存事件到 Nvim，触发 format 等

## FAQ

- Q: Vim Mode 的图标显示异常（比如显示为方框或问号）

  A: 配置 `editor.fontFamily` 或 `terminal.integrated.fontFamily`，增加支持图标的字体，如：`Hack Nerd Font`

## 安装

1. 打开 VS Code
2. 点击侧边栏中的扩展图标或按 `Ctrl+Shift+X` 进入扩展视图
3. 搜索 `vscode-vim-mode`
4. 点击 `安装` 按钮

## 配置 (可选)

安装后，您可以在设置中配置扩展：

1. 点击齿轮图标或按 `Ctrl+,` 打开设置
2. 搜索 `vscode-vim-mode`
3. 配置以下选项：
   - `vscode-vim-mode.vimPath`: (可选) Vim 或 Neovim 可执行文件的路径
   - `vscode-vim-mode.vimArgs`: (可选) 传递给 Vim 可执行文件的参数
   - `vscode-vim-mode.replaySave`: (可选) 使用 Neovim 时，是否在 VSCode 中保存文件时同步事件到 Neovim (触发 format 等)。默认为 false

## 使用

### 切换 Vim 模式

#### 命令

使用命令面板 (`Ctrl+Shift+P`) 并输入以下命令之一：

- `Toggle Vim Mode`/`Vim`: 切换 Vim 模式

#### 按钮

点击 VSCode 编辑器右上角的`Vim` 按钮切换 Vim 模式

## 许可证

此项目使用 MIT 许可证。
