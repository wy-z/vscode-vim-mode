import * as vscode from "vscode";
import * as cp from "node:child_process";
import * as neovim from "neovim";
import * as util from "node:util";

const exec = util.promisify(cp.exec);

const VIM_MODE = "Vim Mode";
const enum EditorTabsMode {
  MULTIPLE = "multiple",
  SINGLE = "single",
  NONE = "none",
}
const NVIM_LISTEN_ADDRESS = "/tmp/vscode-vim-mode";

var vimPath: string;
var oriTabsMode: EditorTabsMode;
var isInVimMode: boolean = false;
var vimTerminal: vscode.Terminal | null = null;

function isNvim(): boolean {
  return vimPath.includes("nvim");
}

async function getNvimCurFile(): Promise<string> {
  try {
    const nvim = neovim.attach({ socket: NVIM_LISTEN_ADDRESS });
    return await nvim.buffer.name;
  } catch (error) {
    console.warn("failed to attach to neovim: ", error);
  }
  return "";
}

async function toggleVimMode() {
  if (isInVimMode) {
    if (!vimTerminal) {
      return;
    }

    // open editing file if nvim
    if (isNvim()) {
      const curFile = await getNvimCurFile();
      vscode.window.showInformationMessage(`Current file: ${curFile}`);
      if (curFile) {
        const document = await vscode.workspace.openTextDocument(curFile);
        vscode.window.showTextDocument(document);
      }
    }
    // exit vim mode
    vimTerminal.dispose();
    return;
  }

  // save original tabs mode
  oriTabsMode =
    vscode.workspace
      .getConfiguration("workbench")
      .get<EditorTabsMode>("editor.showTabs") ?? EditorTabsMode.MULTIPLE;

  // get pwd
  const pwd =
    vscode.workspace.workspaceFolders &&
    vscode.workspace.getWorkspaceFolder(
      vscode.workspace.workspaceFolders[0].uri,
    )?.uri;
  // get current file
  var curFile: string | null = null;
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    curFile = editor.document.uri.fsPath;
  }

  // create terminal
  vimTerminal = vscode.window.createTerminal({
    name: VIM_MODE,
    location: vscode.TerminalLocation.Editor,
  });
  const vimArgs = vscode.workspace
    .getConfiguration("vscode-vim-mode")
    .get<string>("vimArgs");
  var vimCmd = `${vimPath} ${vimArgs} ${curFile || pwd || "./"}`;
  if (isNvim()) {
    vimCmd = `NVIM_LISTEN_ADDRESS=${NVIM_LISTEN_ADDRESS} ${vimCmd}`;
  }
  vimTerminal.sendText(vimCmd, true);
  vscode.commands.executeCommand("workbench.action.hideEditorTabs");
  vimTerminal.show(false);

  // save state
  isInVimMode = true;
}

function handleVimModeExit() {
  // reset tabs
  var cmd: string | null = null;
  vscode.window.showInformationMessage(`Original Tabs Mode: ${oriTabsMode}`);
  if (oriTabsMode === EditorTabsMode.MULTIPLE) {
    cmd = "workbench.action.showMultipleEditorTabs";
  } else if (oriTabsMode === EditorTabsMode.SINGLE) {
    cmd = "workbench.action.showSingleEditorTab";
  }
  if (cmd) {
    vscode.commands.executeCommand(cmd);
  }
  // save state
  isInVimMode = false;
}

export async function activate(context: vscode.ExtensionContext) {
  // get vim path
  vimPath =
    vscode.workspace
      .getConfiguration("vscode-vim-mode")
      .get<string>("vimPath") ||
    (await exec("which nvim || which vim")).stdout.trim();
  if (!vimPath) {
    console.error("vim or neovim not found in path.");
    return;
  }

  const registerToggleCommand = (commandName: string) => {
    const command = vscode.commands.registerCommand(commandName, toggleVimMode);
    context.subscriptions.push(command);
  };
  registerToggleCommand("vscode-vim-mode.toggleVimMode");
  registerToggleCommand("vscode-vim-mode.vim");

  context.subscriptions.push(
    vscode.window.tabGroups.onDidChangeTabs((tabChangeEvent) => {
      for (const removedTab of tabChangeEvent.closed) {
        if (removedTab.label === VIM_MODE) {
          handleVimModeExit();
        }
      }
    }),
  );
}

// This method is called when your extension is deactivated
export async function deactivate() {
  if (isInVimMode) {
    await toggleVimMode();
  }
}
