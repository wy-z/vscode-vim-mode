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
var replaySave: boolean;
var oriTabsMode: EditorTabsMode;
var isInVimMode: boolean = false;
var vimTerminal: vscode.Terminal | null = null;
var nvimProcess: cp.ChildProcess | null = null;
var nvimClient: neovim.NeovimClient | null = null;

function isNvim(): boolean {
  return vimPath.includes("nvim");
}

function needNvimInstance(): boolean {
  return isNvim() && replaySave;
}

function startNvimInstance() {
  nvimProcess = cp.spawn(vimPath, ["--embed", "--headless", "-n"], {
    detached: false,
  });
}

function stopNvimInstance() {
  if (nvimProcess) {
    nvimProcess.kill();
    nvimProcess = null;
  }
}

function getNvim(): neovim.NeovimClient | null {
  if (nvimClient) {
    return nvimClient;
  }

  if (isInVimMode) {
    nvimClient = neovim.attach({ socket: NVIM_LISTEN_ADDRESS });
  } else if (nvimProcess) {
    nvimClient = neovim.attach({ proc: nvimProcess });
  }
  return null;
}

function resetNvim() {
  if (nvimClient) {
    nvimClient.quit();
  }
  nvimClient = null;
}

async function enterVimMode() {
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

  // stop nvim if necessary
  stopNvimInstance();
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
  // reset nvim client
  resetNvim();
}

async function exitVimMode(deactivate = false) {
  if (vimTerminal) {
    // open editing file if nvim
    if (isNvim()) {
      const curFile = await getNvim()?.buffer.name;
      if (curFile) {
        const document = await vscode.workspace.openTextDocument(curFile);
        vscode.window.showTextDocument(document);
      }
    }
    // exit vim mode, trigger handleVimModeExit
    vimTerminal.dispose();
  }
  if (!deactivate && needNvimInstance() && !nvimProcess) {
    startNvimInstance();
  }
}

function handleVimModeExit() {
  // reset tabs
  var cmd: string | null = null;
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
  // reset nvim client
  resetNvim();
}

async function toggleVimMode() {
  if (isInVimMode) {
    await exitVimMode();
    return;
  }
  await enterVimMode();
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
  replaySave =
    vscode.workspace
      .getConfiguration("vscode-vim-mode")
      .get<boolean>("replaySave") || false;

  const registerToggleCommand = (cmdName: string) => {
    const cmd = vscode.commands.registerCommand(cmdName, toggleVimMode);
    context.subscriptions.push(cmd);
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

  // start nvim if necessary
  if (needNvimInstance()) {
    startNvimInstance();
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(async (document) => {
      if (document.uri.scheme !== "file") {
        return;
      }
      if (nvimProcess) {
        await getNvim()?.command(`e ${document.uri.fsPath}`);
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      if (!editor || editor.document.uri.scheme !== "file") {
        return;
      }
      if (nvimProcess) {
        await getNvim()?.command(`e ${editor.document.uri.fsPath}`);
      }
    }),
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (document.uri.scheme !== "file") {
        return;
      }
      if (nvimProcess) {
        await getNvim()?.command(`e ${document.uri.fsPath} | e! | w`);
      }
    }),
  );
}

// This method is called when your extension is deactivated
export async function deactivate() {
  if (isInVimMode) {
    await exitVimMode(true);
  } else {
    stopNvimInstance();
  }
}
