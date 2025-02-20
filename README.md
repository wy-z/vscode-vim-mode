# vscode-vim-mode

[中文文档](README.zh-CN.md)

```
🌟 Probably the most straightforward VSCode & Vim integration plugin
🌟 Leverage both ecosystems, avoid conflicts, and satisfy 'both/and'
🌟 Perfect for heavy Vim users who want to fully enjoy VSCode's ecosystem (e.g., Copilot)
🌟 Can be used alongside other Vim emulation plugins without conflicts (e.g., VSCodeVim, VSCodeNeovim)
```

`vscode-vim-mode` is a Visual Studio Code extension that provides Vim mode. With this extension, users can edit in VS Code using Vim or Neovim.

## Features

- Toggle Vim mode in VS Code
- Support for Vim and Neovim
- Maintain editor tab states
- Sync save events to Nvim, triggering formatting etc.

## Installation

1. Open VS Code
2. Click the Extensions icon in the sidebar or press `Ctrl+Shift+X` to enter the Extensions view
3. Search for `vscode-vim-mode`
4. Click the `Install` button

## Configuration (Optional)

After installation, you can configure the extension in settings:

1. Click the gear icon or press `Ctrl+,` to open settings
2. Search for `vscode-vim-mode`
3. Configure the following options:
   - `vscode-vim-mode.vimPath`: (Optional) Path to Vim or Neovim executable
   - `vscode-vim-mode.vimArgs`: (Optional) Arguments passed to Vim executable
   - `vscode-vim-mode.replaySave`: (Optional) When using Neovim, whether to sync save events to Neovim (triggering format etc). Defaults to false

## Usage

### Toggle Vim Mode

#### Commands

Use the command palette (`Ctrl+Shift+P`) and enter one of the following commands:

- `Toggle Vim Mode`/`Vim`: Toggle Vim mode

#### Button

Click the `Vim` button in the top-right corner of the VSCode editor to toggle Vim mode

## License

This project is licensed under the MIT License.
