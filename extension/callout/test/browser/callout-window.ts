export type CalloutBlock = {
  type: string;
  text: string;
  variant?: string;
};

declare global {
  interface Window {
    calloutReady?: boolean;
    calloutBlocks?: () => CalloutBlock[];
  }
}
