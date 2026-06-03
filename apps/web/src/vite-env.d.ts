/// <reference types="vite/client" />

declare module "*.module.less" {
  const classes: Record<string, string>;
  export default classes;
}

type OpenPathInExplorerResult =
  | { ok: true; openedParent?: boolean }
  | { ok: false; error: string };

type MyNotesDesktopBridge = {
  platform: string;
  versions: {
    chrome: string;
    electron: string;
    node: string;
  };
  openPathInExplorer?: (path: string) => Promise<OpenPathInExplorerResult>;
};

declare global {
  interface Window {
    __MY_NOTES_DESKTOP__?: MyNotesDesktopBridge;
  }
}

export {};
