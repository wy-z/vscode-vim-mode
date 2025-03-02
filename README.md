# vscode-vim-mode

## TL;DR

```
🌟 Transforms VS Code into a GVim by running Vim within its integrated terminal

🌟 Preserves editing states between sessions, sync file save actions between VSCode and Vim

🌟 Only suitable for hardcore Vim users, you need to have a meticulously configured Vim environment already in place

🌟 Untested on Windows, it should work with WSL
```

---

[中文文档](README.zh-CN.md)

`vscode-vim-mode` is a Visual Studio Code extension that provides Vim mode. With this extension, users can edit in VS Code using Vim or Neovim.

```
🌟 Use full Vim features in VSCode with seamless switching
🌟 Perfect for heavy Vim users who want to fully enjoy VSCode's ecosystem (e.g., Copilot)
🌟 Probably the most straightforward VSCode & Vim integration plugin
🌟 Leverage both ecosystems, avoid conflicts, and satisfy 'both/and'
🌟 Can be used alongside other Vim emulation plugins without conflicts (e.g., VSCodeNeovim, VSCodeVim)
```

## Features

- Toggle Vim mode in VS Code while preserving editing state
- Support for Vim and Neovim
- Sync save events to Nvim, triggering formatting etc.

## FAQ

- Q: Vim Mode icon displays abnormally (shows as a square or question mark)

  A: Configure `editor.fontFamily` or `terminal.integrated.fontFamily`, add a font that supports icons, such as: `Hack Nerd Font`

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
