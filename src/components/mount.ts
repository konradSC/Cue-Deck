import React from "react";
import ReactDOM from "react-dom";

// Spotify's bundled React changes between client versions: newer ones only
// have createRoot, older ones only have render. Returns an unmount function.
export function mount(host: HTMLElement, node: React.ReactElement): () => void {
  const RD: any = ReactDOM;
  if (typeof RD.createRoot === "function") {
    const root = RD.createRoot(host);
    root.render(node);
    return () => root.unmount();
  }
  RD.render(node, host);
  return () => RD.unmountComponentAtNode(host);
}
