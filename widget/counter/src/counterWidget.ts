import { $getSelection, $insertNodes, $isRangeSelection } from "lexical";
import { AT_CARET, EditorExtension, FONT_FAMILY, $createWidgetNode, type EditorContext, type EditorCommand, type SelectionInfo, type BakedForm, type BakeTarget, type ThemeTokenDef, type WidgetContext, type WidgetDef, type WidgetState } from "@paginary/core";

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
  defaultSize: { width: 140, height: 30 },
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
    const card = el.ownerDocument.createElement("span");
    card.className = "pg-counter";
    const output = el.ownerDocument.createElement("output");
    output.className = "pg-counter-count";
    output.dataset.counterCount = "";
    const button = el.ownerDocument.createElement("button");
    button.className = "pg-counter-button";
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
    card.replaceChildren(output, button);
    el.replaceChildren(card);
    drawCount(el, ctx.state);

    // #endregion mount-widget
    // #region handle
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
    // #endregion handle
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
      return { form: "markup", html: `<span class="pg-counter"><output class="pg-counter-count" data-counter-count>${count}</output></span>` };
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
    // #region commands-short
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
    // #endregion commands-short
  }

  // #region command-enabled
  commandEnabled(name: string, selection: SelectionInfo, ctx: EditorContext): boolean {
    if (name !== INSERT_COUNTER) return super.commandEnabled(name, selection, ctx);
    return selection.kind === "caret" || selection.kind === "range";
  }
  // #endregion command-enabled
  // #endregion commands

  // #region widgets
  widgets(): readonly WidgetDef[] {
    return [counterWidget];
  }
  // #endregion widgets

  // #region look
  themeTokens(): readonly ThemeTokenDef[] {
    return [
      { name: "--pg-counter-bg", value: "#f8fafc", label: "Counter background" },
      { name: "--pg-counter-border", value: "#cbd5e1", label: "Counter border" },
      { name: "--pg-counter-accent", value: "#2563eb", label: "Counter accent" },
      { name: "--pg-counter-accent-ink", value: "#ffffff", label: "Counter accent ink" },
    ];
  }

  // A default-theme document defines no tokens, so each fallback supplies the value that draws the card.
  styles(): string {
    return `
.pg-counter { box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; gap: 10px; padding: 0 3px 0 10px; background: var(--pg-counter-bg, #f8fafc); border: 1px solid var(--pg-counter-border, #cbd5e1); border-radius: 6px; }
.pg-counter-count { font: 600 18px/1 var(--pg-font-family, ${FONT_FAMILY}); font-variant-numeric: tabular-nums; min-width: 2ch; color: var(--pg-ink, #1f2933); }
.pg-counter-button { margin-left: auto; padding: 4px 10px; border: 0; border-radius: 4px; background: var(--pg-counter-accent, #2563eb); color: var(--pg-counter-accent-ink, #ffffff); font: 500 12px/1.2 var(--pg-font-family, ${FONT_FAMILY}); cursor: pointer; }
.pg-counter-button:hover { filter: brightness(1.08); }
.pg-counter-button:focus-visible { outline: 2px solid var(--pg-counter-accent, #2563eb); outline-offset: 2px; }
.pg-counter-button:disabled { opacity: .5; cursor: default; }
`;
  }
  // #endregion look
}
// #endregion extension
