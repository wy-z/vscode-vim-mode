import * as neovim from "neovim";
import * as net from "node:net";

// retry until task return true
export function Retry({
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

// rewrite neovim socket attach to handle exception
export async function NeovimAttachSocket(
  socket: string,
): Promise<neovim.NeovimClient> {
  const client: net.Socket = await new Promise((resolve, reject) => {
    const c = net.createConnection(socket);
    c.once("connect", () => resolve(c));
    c.once("error", (err) => reject(err));
  });
  const nvim = new neovim.NeovimClient();
  nvim.attach({
    writer: client,
    reader: client,
  });
  return nvim;
}
