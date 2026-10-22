import { Editor } from "@paginary/core";
import { CounterWidgetExtension, INSERT_COUNTER } from "../src/counterWidget.ts";

// #region registration
/** Create an editor that registers the counter widget. */
export function createCounterEditor(host: HTMLElement): Editor {
  return new Editor(host, {
    extensions: [new CounterWidgetExtension()],
  });
}

/** Insert a counter at the current editor selection from a host button or menu item. */
export function insertCounter(editor: Editor): void {
  editor.runCommand(INSERT_COUNTER);
}
// #endregion registration
