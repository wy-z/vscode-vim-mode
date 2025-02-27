import * as vscode from "vscode";
import * as cp from "node:child_process";
import * as fs from "node:fs";
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

interface editState {
  file?: string;
  line?: number;
}

const THIS = "vscode-vim-mode";

class VimMode {
  static NVIM_LISTEN_ADDRESS = "/tmp/" + THIS;
  static MODE_NAME = "Vim Mode";

  context: vscode.ExtensionContext;
  config: Config;
  editState: editState = {};
  vimTerminal: vscode.Terminal | null = null;
  nvimProc: cp.ChildProcess | null = null;
  nvimClient: neovim.NeovimClient | null = null;
  isActive = false;
  isDisposing = false;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.config = this.loadConfig();
  }

  static KEY_TABS_MODE = "TabsMode";

  get tabsMode() {
    return this.context.globalState.get<EditorTabsMode>(VimMode.KEY_TABS_MODE);
  }

  set tabsMode(mode: EditorTabsMode | undefined) {
    this.context.globalState.update(VimMode.KEY_TABS_MODE, mode);
  }

  loadConfig(): Config {
    const conf = vscode.workspace.getConfiguration(THIS);
    return {
      vimPath: conf.get("vimPath") || "",
      vimArgs: conf.get("vimArgs") || "",
      replaySave: conf.get("replaySave") || false,
    };
  }

  registerCommands() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(THIS + ".toggleVimMode", async () =>  // 添加 async
        await this.toggle(),
      ),
      vscode.commands.registerCommand(THIS + ".vim", async () =>  // 添加 async
        await this.toggle(),
      ),
    );
  }

  registerEventHandlers() {
    this.context.subscriptions.push(
      vscode.window.tabGroups.onDidChangeTabs(async (e) => {
        if (e.closed.some((tab) => tab.label === VimMode.MODE_NAME)) {
          await this.handleExit();
        }
      }),
      vscode.workspace.onDidOpenTextDocument(
        async (doc) => await this.syncFile(doc.uri),
      ),
      vscode.window.onDidChangeActiveTextEditor(
        async (e) => e && (await this.syncFile(e.document.uri)),
      ),
      vscode.workspace.onDidSaveTextDocument(
        async (doc) => await this.syncFileSave(doc.uri),
      ),
      // exit vim mode when text editor changed
      vscode.window.onDidChangeActiveTextEditor(async (e) => {
        if (e && this.isActive) {
          await this.exit();
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
    if (!this.nvimClient) {
      if (this.isActive && fs.existsSync(VimMode.NVIM_LISTEN_ADDRESS)) {
        this.nvimClient = neovim.attach({
          socket: VimMode.NVIM_LISTEN_ADDRESS,
        });
      } else if (this.nvimProc) {
        this.nvimClient = neovim.attach({ proc: this.nvimProc });
      }
    }
    // nvim may be exited
    if (this.isActive && !fs.existsSync(VimMode.NVIM_LISTEN_ADDRESS)) {
      this.resetNvimClient();
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

  async beforeEnter() {
    // save original tabs mode
    if (!this.tabsMode) {
      this.tabsMode =
        vscode.workspace
          .getConfiguration("workbench")
          .get<EditorTabsMode>("editor.showTabs") ?? EditorTabsMode.MULTIPLE;
    }

    // save edit state
    this.editState = {};
    const editor = vscode.window.activeTextEditor;
    this.editState.file = editor?.document.uri.fsPath;
    if (this.editState.file) {
      this.editState.line = editor?.selection.active.line;
    }

    // stop nvim if necessary
    this.stopNvimProc();
  }

  async enter() {
    await this.beforeEnter();

    // get pwd
    const pwd =
      vscode.workspace.workspaceFolders &&
      vscode.workspace.getWorkspaceFolder(
        vscode.workspace.workspaceFolders[0].uri,
      )?.uri.fsPath;
    // create terminal
    this.vimTerminal = vscode.window.createTerminal({
      name: VimMode.MODE_NAME,
      location: vscode.TerminalLocation.Editor,
    });
    const vimArgs = vscode.workspace
      .getConfiguration(THIS)
      .get<string>("vimArgs");
    var vimCmd = `${this.config.vimPath} ${vimArgs} '${this.editState.file || pwd || "./"}'`;
    if (this.hasNvim()) {
      vimCmd = `NVIM_LISTEN_ADDRESS=${VimMode.NVIM_LISTEN_ADDRESS} ${vimCmd}`;
    }
    // terminal PATH may be disordered
    this.vimTerminal.sendText(`PATH=${process.env.PATH} ` + vimCmd, true);
    vscode.commands.executeCommand("workbench.action.hideEditorTabs");
    this.vimTerminal.show(false);

    // save state
    this.isActive = true;
    // reset nvim client
    this.resetNvimClient();
    // after enter
    await this.afterEnter();
  }

  async afterEnter() {
    // go to line
    if (this.editState.line) {
      const line = this.editState.line + 1;
      this.vimTerminal?.sendText(`:${line}`, true);
    }
  }

  async beforeExit() {
    // save edit state
    this.editState = {};
    if (this.vimTerminal) {
      // open editing file if nvim
      if (this.hasNvim()) {
        this.editState.file = await this.getNvimClient()?.buffer.name;

        if (this.editState.file && fs.existsSync(this.editState.file)) {
          const document = await vscode.workspace.openTextDocument(
            this.editState.file,
          );
          vscode.window.showTextDocument(document);

          // save current line
          const cursor = await this.getNvimClient()?.window.cursor;
          if (cursor) {
            this.editState.line = cursor[0];
          }
        }
      }
    }
  }

  async exit() {
    await this.beforeExit();

    if (this.vimTerminal) {
      // exit vim mode, trigger handleVimModeExit
      this.vimTerminal.dispose();
    }
  }

  async handleExit() {
    // reset tabs
    const tabsMode = vscode.workspace
      .getConfiguration("workbench")
      .get<EditorTabsMode>("editor.showTabs");
    if (tabsMode !== this.tabsMode) {
      if (this.tabsMode === EditorTabsMode.MULTIPLE) {
        vscode.commands.executeCommand(
          "workbench.action.showMultipleEditorTabs",
        );
      } else if (this.tabsMode === EditorTabsMode.SINGLE) {
        vscode.commands.executeCommand("workbench.action.showSingleEditorTab");
      }
    }
    // reset tabs mode
    this.tabsMode = undefined;
    // save state
    this.isActive = false;
    // reset nvim client
    this.resetNvimClient();
    // after exit
    await this.afterExit();
  }

  async afterExit() {
    // go to line
    if (this.editState.line) {
      const line = this.editState.line - 1;
      retry({
        task: async () => {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            return false;
          }
          const position = new vscode.Position(line, 0);
          editor.selection = new vscode.Selection(position, position);
          editor.revealRange(new vscode.Range(position, position));
          return true;
        },
        interval: 200,
        timeout: 2000,
        onTimeout: () => {
          console.warn("timeout to set editor line");
        },
      });
    }

    // start nvim if necessary
    if (!this.isDisposing && this.needNvimProc() && !this.nvimProc) {
      this.startNvimProc();
    }
  }

  async toggle() {
    this.isActive ? await this.exit() : await this.enter();
  }

  async dispose() {
    this.isDisposing = true;
    this.isActive ? await this.exit() : this.stopNvimProc();
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

  // reexit vim mode if necessary
  await vimMode.handleExit();
}

// This method is called when your extension is deactivated
export async function deactivate() {
  await vimMode?.dispose();
}

//
// Utils
//

function retry({
  task,
  interval,
  timeout,
  onTimeout,
  onError,
}: {
  task: () => Promise<boolean>;
  interval: number;
  timeout?: number;
  onTimeout?: () => void;
  onError?: (error: any) => void;
}): () => void {
  let intervalId: NodeJS.Timeout;
  let timeoutId: NodeJS.Timeout | null = null;
  const cancel = () => {
    clearInterval(intervalId);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };

  // interval
  intervalId = setInterval(async () => {
    try {
      if (await task()) {
        cancel();
      }
    } catch (error) {
      if (onError) {
        onError(error);
      }
    }
  }, interval);
  // timeout
  if (timeout) {
    timeoutId = setTimeout(() => {
      clearInterval(intervalId);
      if (onTimeout) {
        onTimeout();
      }
    }, timeout);
  }
  // return cancel
  return cancel;
}
