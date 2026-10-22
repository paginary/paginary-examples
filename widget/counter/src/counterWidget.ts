import { $getSelection, $insertNodes, $isRangeSelection } from "lexical";
import { AT_CARET, EditorExtension, $createWidgetNode, type EditorContext, type EditorCommand, type SelectionInfo, type BakedForm, type BakeTarget, type WidgetContext, type WidgetDef, type WidgetState } from "@paginary/core";

const COUNTER_IMAGE = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="),
  (character) => character.charCodeAt(0),
);

function countOf(state: WidgetState): number {
  return typeof state.count === "number" ? state.count : 0;
}

function drawCount(el: HTMLElement, state: WidgetState): void {
  const output = el.querySelector<HTMLOutputElement>("[data-counter-count]");
  if (output) output.textContent = String(countOf(state));
}

// #region inputs
function stepOf(ctx: WidgetContext): number {
  const input = ctx.inputs.step;
  return input?.status === "value" && typeof input.value === "number" ? input.value : 1;
}
// #endregion inputs

function buttonLabel(ctx: WidgetContext): string {
  return `Add ${stepOf(ctx)}`;
}

// #region names
/** Command name a host button or menu item can run to insert the counter at the current selection. */
export const INSERT_COUNTER = "example-insert-counter";
// #endregion names

/** The smallest complete widget: state, migration, inputs, live rendering, static export, and insertion. */
export const counterWidget: WidgetDef = {
  // #region declaration
  // #region declare-widget
  type: "example.counter",
  version: 2,
  label: "Counter",
  defaultSize: { width: 180, height: 64 },
  exportForms: ["markup", "image"],
  inputs: { step: { kind: "number" } },
  outputs: { count: { kind: "number" } },
  // #endregion declare-widget
  // #endregion declaration

  // #region migrate
  // Migration changes old persisted state into the current state shape without writing the document.
  migrate: (fromVersion, state) => fromVersion === 1 ? { count: typeof state.value === "number" ? state.value : 0 } : state,
  // #endregion migrate

  // #region derive
  // Derive exposes a read-only projection that other widgets can bind to.
  derive: (state) => ({ count: countOf(state) }),
  // #endregion derive

  // #region mount
  // #region mount-widget
  // Mount owns the initial DOM because the widget must render its count and action as one replaceable box.
  mount: (el, ctx) => {
    const output = el.ownerDocument.createElement("output");
    output.dataset.counterCount = "";
    const button = el.ownerDocument.createElement("button");
    button.type = "button";
    button.textContent = buttonLabel(ctx);

    // #region save-click
    // Each lifecycle call gets a fresh, frozen context, so the handler must keep the latest one.
    let current = ctx;
    const increment = (): void => {
      const step = stepOf(current);
      current.setState({ ...current.state, count: countOf(current.state) + step });
    };
    button.disabled = ctx.readOnly;
    button.addEventListener("click", increment);
    // #endregion save-click
    el.replaceChildren(output, button);
    drawCount(el, ctx.state);

    // #endregion mount-widget
    return {
      // Update redraws the existing interior when state or inputs change. Assigning next first makes a later
      // click use the fresh resolved input rather than the frozen context from mount.
      update: (next) => {
        current = next;
        button.disabled = next.readOnly;
        button.textContent = buttonLabel(next);
        drawCount(el, next.state);
      },
      // Unmount releases listeners and child DOM owned by this widget instance.
      unmount: () => {
        button.removeEventListener("click", increment);
        el.replaceChildren();
      },
    };
  },
  // #endregion mount

  // Render errors stay inside the widget box and explain why its live view is unavailable.
  renderError: (el, error) => {
    const detail = error instanceof Error ? error.message : String(error);
    el.replaceChildren(el.ownerDocument.createTextNode(`Counter failed to render: ${detail}`));
  },

  // #region bake
  // #region test-widget
  // Bake is DOM-free so tests can verify the widget's export without mounting a browser surface.
  bake: (state, _query, target: BakeTarget): BakedForm | null => {
    const count = countOf(state);
    if (target.forms.includes("markup")) {
      return { form: "markup", html: `<output data-counter-count>${count}</output>` };
    }
    if (target.forms.includes("image")) {
      return { form: "image", bytes: COUNTER_IMAGE, mediaType: "image/png", alt: `Counter showing ${count}` };
    }
    return null;
  },
  // #endregion test-widget
  // #endregion bake
};

// #region extension
/** Register the counter with an editor by adding this extension to its extension list. */
export class CounterWidgetExtension extends EditorExtension {
  readonly name = "example-counter";

  // #region commands
  commands(): Readonly<Record<string, EditorCommand>> {
    return {
      [INSERT_COUNTER]: (ctx: EditorContext) => {
        if (!ctx.selectAt(AT_CARET)) {
          ctx.notify({
            source: this.name,
            code: "PG-COUNTER-INSERT-UNSUPPORTED",
            severity: "refuse",
            detail: "Cannot insert a counter: the editor has no selection.",
          });
          return;
        }
        if (ctx.selection.kind !== "caret" && ctx.selection.kind !== "range") {
          ctx.notify({
            source: this.name,
            code: "PG-COUNTER-INSERT-UNSUPPORTED",
            severity: "refuse",
            detail: "Cannot insert a counter: select text or place the caret where it should be inserted.",
          });
          return;
        }
        ctx.editor.update(() => {
          if (!$isRangeSelection($getSelection())) return;
          const { width, height } = counterWidget.defaultSize;
          $insertNodes([$createWidgetNode(counterWidget.type, counterWidget.version, width, height)]);
        });
      },
    };
  }

  commandEnabled(name: string, selection: SelectionInfo, ctx: EditorContext): boolean {
    if (name !== INSERT_COUNTER) return super.commandEnabled(name, selection, ctx);
    return selection.kind === "caret" || selection.kind === "range";
  }
  // #endregion commands

  widgets(): readonly WidgetDef[] {
    return [counterWidget];
  }
}
// #endregion extension
