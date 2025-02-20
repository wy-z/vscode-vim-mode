import * as vscode from "vscode";
import * as cp from "node:child_process";
import * as neovim from "neovim";
import * as util from "node:util";

const exec = util.promisify(cp.exec);

const enum EditorTabsMode {
  MULTIPLE = "multiple",
  SINGLE = "single",
  NONE = "none",
}

interface Config {
  vimPath: string;
  vimArgs: string;
  replaySave: boolean;
}

class VimMode {
  static NVIM_LISTEN_ADDRESS = "/tmp/vscode-vim-mode";
  static MODE_NAME = "Vim Mode";

  context: vscode.ExtensionContext;
  config: Config;
  oriTabsMode: EditorTabsMode;
  vimTerminal: vscode.Terminal | null = null;
  nvimProc: cp.ChildProcess | null = null;
  nvimClient: neovim.NeovimClient | null = null;
  isActive = false;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.config = this.loadConfig();
    this.oriTabsMode = EditorTabsMode.MULTIPLE;
  }

  loadConfig(): Config {
    const conf = vscode.workspace.getConfiguration("vscode-vim-mode");
    return {
      vimPath: conf.get("vimPath") || "",
      vimArgs: conf.get("vimArgs") || "",
      replaySave: conf.get("replaySave") || false,
    };
  }

  registerCommands() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand("vscode-vim-mode.toggleVimMode", () =>
        this.toggle(),
      ),
      vscode.commands.registerCommand("vscode-vim-mode.vim", () =>
        this.toggle(),
      ),
    );
  }

  registerEventHandlers() {
    this.context.subscriptions.push(
      vscode.window.tabGroups.onDidChangeTabs((e) => {
        if (e.closed.some((tab) => tab.label === VimMode.MODE_NAME)) {
          this.handleExit();
        }
      }),
      vscode.workspace.onDidOpenTextDocument((doc) => this.syncFile(doc.uri)),
      vscode.window.onDidChangeActiveTextEditor(
        (e) => e && this.syncFile(e.document.uri),
      ),
      vscode.workspace.onDidSaveTextDocument((doc) =>
        this.syncFileSave(doc.uri),
      ),
      // exit vim mode when text editor changed
      vscode.window.onDidChangeActiveTextEditor((e) => {
        if (e && this.isActive) {
          this.handleExit();
        }
      }),
    );
  }

  async syncFile(uri: vscode.Uri) {
    if (uri.scheme === "file" && this.nvimProc) {
      await this.getNvimClient()?.command(`e ${uri.fsPath}`);
    }
  }

  async syncFileSave(uri: vscode.Uri) {
    if (uri.scheme === "file" && this.nvimProc) {
      await this.getNvimClient()?.command(`e ${uri.fsPath} | e! | w`);
    }
  }

  hasNvim(): boolean {
    return this.config.vimPath.includes("nvim");
  }

  needNvimProc(): boolean {
    return this.hasNvim() && this.config.replaySave;
  }

  getNvimClient(): neovim.NeovimClient | null {
    if (this.nvimClient) {
      return this.nvimClient;
    }

    if (this.isActive) {
      this.nvimClient = neovim.attach({ socket: VimMode.NVIM_LISTEN_ADDRESS });
    } else if (this.nvimProc) {
      this.nvimClient = neovim.attach({ proc: this.nvimProc });
    }
    return this.nvimClient;
  }

  resetNvimClient() {
    if (this.nvimClient) {
      this.nvimClient.quit();
    }
    this.nvimClient = null;
  }

  startNvimProc() {
    this.nvimProc = cp.spawn(
      this.config.vimPath,
      ["--embed", "--headless", "-n"],
      {
        detached: false,
      },
    );
  }

  stopNvimProc() {
    if (this.nvimProc) {
      this.nvimProc.kill();
      this.nvimProc = null;
    }
  }

  async enter() {
    // save original tabs mode
    this.oriTabsMode =
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
    this.stopNvimProc();
    // create terminal
    this.vimTerminal = vscode.window.createTerminal({
      name: VimMode.MODE_NAME,
      location: vscode.TerminalLocation.Editor,
    });
    const vimArgs = vscode.workspace
      .getConfiguration("vscode-vim-mode")
      .get<string>("vimArgs");
    var vimCmd = `${this.config.vimPath} ${vimArgs} ${curFile || pwd || "./"}`;
    if (this.hasNvim()) {
      vimCmd = `NVIM_LISTEN_ADDRESS=${VimMode.NVIM_LISTEN_ADDRESS} ${vimCmd}`;
    }
    this.vimTerminal.sendText(vimCmd, true);
    vscode.commands.executeCommand("workbench.action.hideEditorTabs");
    this.vimTerminal.show(false);

    // save state
    this.isActive = true;
    // reset nvim client
    this.resetNvimClient();
  }

  async exit(deactivate = false) {
    if (this.vimTerminal) {
      // open editing file if nvim
      if (this.hasNvim()) {
        const curFile = await this.getNvimClient()?.buffer.name;
        if (curFile) {
          const document = await vscode.workspace.openTextDocument(curFile);
          vscode.window.showTextDocument(document);
        }
      }
      // exit vim mode, trigger handleVimModeExit
      this.vimTerminal.dispose();
    }
    if (!deactivate && this.needNvimProc() && !this.nvimProc) {
      this.startNvimProc();
    }
  }

  handleExit() {
    // reset tabs
    var cmd: string | null = null;
    if (this.oriTabsMode === EditorTabsMode.MULTIPLE) {
      cmd = "workbench.action.showMultipleEditorTabs";
    } else if (this.oriTabsMode === EditorTabsMode.SINGLE) {
      cmd = "workbench.action.showSingleEditorTab";
    }
    if (cmd) {
      vscode.commands.executeCommand(cmd);
    }
    // save state
    this.isActive = false;
    // reset nvim client
    this.resetNvimClient();
  }

  async toggle() {
    this.isActive ? await this.exit() : await this.enter();
  }

  dispose() {
    this.isActive ? this.exit(true) : this.stopNvimProc();
  }
}

let vimMode: VimMode;

export async function activate(context: vscode.ExtensionContext) {
  vimMode = new VimMode(context);

  // update vim path
  vimMode.config.vimPath =
    vimMode.config.vimPath ||
    (await exec("which nvim || which vim")).stdout.trim();
  if (!vimMode.config.vimPath) {
    throw new Error("vim or neovim not found");
  }
  vimMode.registerCommands();
  vimMode.registerEventHandlers();

  // start nvim if necessary
  if (vimMode.needNvimProc()) {
    vimMode.startNvimProc();
  }
}

// This method is called when your extension is deactivated
export async function deactivate() {
  vimMode?.dispose();
}
