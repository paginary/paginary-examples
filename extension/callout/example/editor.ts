import { Editor } from "@paginary/core";
import { CalloutExtension } from "../src/index.ts";

// #region registration
/** Create an editor that registers the callout content type. */
export function createCalloutEditor(host: HTMLElement): Editor {
  return new Editor(host, {
    extensions: [new CalloutExtension()],
  });
}
// #endregion registration
