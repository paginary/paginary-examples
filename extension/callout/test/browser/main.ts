import { $createTextNode, $getRoot } from "lexical";
import { createCalloutEditor } from "../../example/editor.ts";
import { $createCalloutNode } from "../../src/index.ts";

declare global {
  interface Window {
    calloutReady?: boolean;
  }
}

// #region mount-editor
const host = document.querySelector<HTMLElement>("#editor");
if (!host) throw new Error("The browser fixture has no editor host");

const editor = createCalloutEditor(host);
editor.editor.update(() => {
  const warning = $createCalloutNode("warning");
  warning.append($createTextNode("Warning: check the package before publishing."));

  const note = $createCalloutNode("note");
  const sentences = Array.from({ length: 150 }, (_, index) => `Sentence ${index + 1} of the note.`).join(" ");
  note.append($createTextNode(sentences));
  $getRoot().clear().append(warning, note);
});

const nextFrame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));
await nextFrame();
await nextFrame();
window.calloutReady = true;
// #endregion mount-editor
