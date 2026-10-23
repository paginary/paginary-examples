import {
  $carryBlockDataOnTurnInto,
  canTurnIntoBlock,
  EditorExtension,
  selectionSlice,
  variantProjectionCss,
  variantsFor,
  type CapabilityDeclaration,
  type DocumentTheme,
  type EditorCommand,
  type EditorContext,
  type RoleDef,
  type SelectionInfo,
  type ThemeTokenDef,
} from "@paginary/core";
import {
  $findMatchingParent,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  INSERT_PARAGRAPH_COMMAND,
  type Klass,
  type LexicalEditor,
  type LexicalNode,
} from "lexical";
import { $setBlocksType } from "@lexical/selection";
import { CalloutNode, $createCalloutNode, $isCalloutNode, type CalloutVariant } from "./CalloutNode.ts";
import { DEFAULT_CALLOUT_INDENT_PX, CalloutFlattener, CalloutLayouter, CalloutRenderer } from "./calloutLayout.ts";

// #region names
export const CALLOUT_EXTENSION_NAME = "example-callout";
export const TURN_INTO_CALLOUT = "example-turn-into-callout";
export const SET_CALLOUT_VARIANT = "example-set-callout-variant";
export const CALLOUT_SLICE = selectionSlice<{ readonly variant: string }>(CALLOUT_EXTENSION_NAME);

const DEFAULT_WARNING_VARIANT = {
  "--pg-callout-bg": "#fffbeb",
  "--pg-callout-accent": "#f59e0b",
} as const;
// #endregion names

function calloutFromSelection(): CalloutNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const anchorCallout = $findMatchingParent(selection.anchor.getNode(), $isCalloutNode) as CalloutNode | null;
  const focusCallout = $findMatchingParent(selection.focus.getNode(), $isCalloutNode) as CalloutNode | null;
  return anchorCallout !== null && focusCallout?.getKey() === anchorCallout.getKey() ? anchorCallout : null;
}

// #region class
/** A complete block-callout extension built only on the public core seams. */
export class CalloutExtension extends EditorExtension {
  readonly name = CALLOUT_EXTENSION_NAME;
  private readonly flattener = new CalloutFlattener();
  private readonly layouter = new CalloutLayouter();
  private readonly renderer = new CalloutRenderer();
  private context: EditorContext | null = null;

  nodes(): ReadonlyArray<Klass<LexicalNode>> {
    return [CalloutNode];
  }

  flatteners(): readonly CalloutFlattener[] {
    return [this.flattener];
  }

  layouters(): readonly CalloutLayouter[] {
    return [this.layouter];
  }

  regionRenderers(): readonly CalloutRenderer[] {
    return [this.renderer];
  }
// #endregion class

// #region lifecycle
// #region register-extension
  register(editor: LexicalEditor, ctx: EditorContext): () => void {
    const removeEnterHandler = editor.registerCommand(
      INSERT_PARAGRAPH_COMMAND,
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return false;
        const callout = calloutFromSelection();
        return callout ? callout.handleEnter(selection) : false;
      },
      COMMAND_PRIORITY_HIGH,
    );

    // Keep the active context on the extension so layout can read the document theme until cleanup.
    this.context = ctx;
    this.layouter.setContext(ctx);
    return () => {
      removeEnterHandler();
      if (this.context !== ctx) return;
      this.context = null;
      this.layouter.setContext(null);
    };
  }
// #endregion register-extension
// #endregion lifecycle

// #region capabilities
  capabilities(): CapabilityDeclaration {
    return { nodes: [{ type: CalloutNode.getType(), fields: ["variant"] }] };
  }
// #endregion capabilities

// #region commands
  commands(): Readonly<Record<string, EditorCommand>> {
    return {
      // #region add-commands
      [TURN_INTO_CALLOUT]: (ctx: EditorContext) => {
        if (!canTurnIntoBlock(ctx)) {
          ctx.notify({
            source: this.name,
            code: "PG-CALLOUT-TURN-INTO-UNSUPPORTED",
            severity: "refuse",
            detail: "Cannot turn the selection into a callout: none of the selected blocks holds text.",
          });
          return;
        }
        ctx.editor.update(() => {
          $setBlocksType($getSelection(), $createCalloutNode, $carryBlockDataOnTurnInto);
        });
      },
      // #endregion add-commands
      // #region set-variant
      [SET_CALLOUT_VARIANT]: (ctx: EditorContext, ...args: unknown[]) => {
        const requested = args[0];
        const commandContext = this.context ?? ctx;
        const variants = variantsFor(commandContext.documentTheme, "callout");
        const valid = requested === "note" || requested === "warning" || (typeof requested === "string" && Object.prototype.hasOwnProperty.call(variants, requested));
        if (!valid) {
          ctx.notify({
            source: this.name,
            code: "PG-CALLOUT-VARIANT-INVALID",
            severity: "refuse",
            detail: `Cannot set the callout variant to ${JSON.stringify(requested)}: it is not note, warning, or a variant in the active document theme.`,
            subject: String(requested),
          });
          return;
        }
        ctx.editor.update(() => {
          const callout = calloutFromSelection();
          if (callout) callout.setVariant(requested as CalloutVariant);
        });
      },
      // #endregion set-variant
    };
  }

// #region command-enabled
  commandEnabled(name: string, _selection: SelectionInfo, ctx: EditorContext): boolean {
    if (name === TURN_INTO_CALLOUT) return canTurnIntoBlock(ctx);
    if (name === SET_CALLOUT_VARIANT) return ctx.editor.getEditorState().read(() => calloutFromSelection() !== null);
    return super.commandEnabled(name, _selection, ctx);
  }
// #endregion command-enabled
// #endregion commands

// #region selection
  selectionSlice(ctx: EditorContext): { readonly variant: string } | undefined {
    return ctx.editor.getEditorState().read(() => {
      const callout = calloutFromSelection();
      return callout ? { variant: callout.getVariant() } : undefined;
    });
  }
// #endregion selection

// #region theming
// #region theme-callout
  themeTokens(): readonly ThemeTokenDef[] {
    return [
      { name: "--pg-callout-bg", value: "#eff6ff", label: "Callout background" },
      { name: "--pg-callout-accent", value: "#3b82f6", label: "Callout accent" },
      { name: "--pg-callout-indent", value: `${DEFAULT_CALLOUT_INDENT_PX}px`, label: "Callout indent", affectsLayout: true },
    ];
  }

  themeRoles(): readonly RoleDef[] {
    return [{ name: "callout", namespace: "text", continuousSelector: ".pg-callout", default: {} }];
  }

  variantProjection(theme: DocumentTheme, scope: string): string {
    const themed = variantsFor(theme, "callout");
    // Built-in warning values provide a complete variant, while explicit theme values remain authoritative overrides.
    return variantProjectionCss(scope, "data-callout-variant", {
      ...themed,
      warning: { ...DEFAULT_WARNING_VARIANT, ...themed.warning },
    });
  }
// #endregion theme-callout
// #endregion theming

// #region styles
  styles(): string {
    return `
.pg-callout-band { background: var(--pg-callout-bg, #eff6ff); box-sizing: border-box; }
.pg-callout-rail { background: var(--pg-callout-accent, #3b82f6); width: 4px; }
.pg-callout-content { box-sizing: border-box; }
`;
  }
// #endregion styles
}
