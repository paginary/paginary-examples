import type { LexicalNode } from "lexical";
import type {
  BlockFlattener,
  BlockInput,
  BlockLayouter,
  EditorContext,
  ExtractContext,
  LayoutResult,
  Region,
  RegionCursor,
  RegionRenderer,
  RegionRenderContext,
  ResumeToken,
  StreamCursor,
} from "@paginary/core";
import { $isCalloutNode, type CalloutVariant } from "./CalloutNode.ts";

export const CALLOUT_BLOCK = "example-callout";
export const DEFAULT_CALLOUT_INDENT_PX = 24;
const STREAM_START: StreamCursor = { index: 0, token: null };
type CalloutRegionData = { readonly variant: CalloutVariant; readonly indent: number };

export interface CalloutBlock extends BlockInput {
  readonly type: typeof CALLOUT_BLOCK;
  readonly blocks: readonly BlockInput[];
  readonly variant: CalloutVariant;
}

// #region indent
/** Resolve a callout's indent from its variant-scoped document cascade, with the example default for headless use. */
export function calloutIndent(context: EditorContext | null, variant: CalloutVariant): number {
  const value = context?.cascade({ variant: { namespace: "callout", name: variant } }).value("--pg-callout-indent") ?? `${DEFAULT_CALLOUT_INDENT_PX}px`;
  const indent = Number.parseFloat(value);
  return Number.isFinite(indent) && indent >= 0 ? indent : DEFAULT_CALLOUT_INDENT_PX;
}
// #endregion indent

// #region flattener
// #region flow-text
/** Turns a callout node's direct inline text into one container block so shared paragraph pagination carries across pages. */
export class CalloutFlattener implements BlockFlattener {
  match(node: LexicalNode): boolean {
    return $isCalloutNode(node);
  }

  flatten(node: LexicalNode, ctx: ExtractContext): BlockInput[] {
    if (!$isCalloutNode(node)) return [];
    const { blocks, spaceBefore, spaceAfter } = ctx.containedParagraph(node, { role: "callout", box: { tag: "p" } });
    const block: CalloutBlock = {
      key: node.getKey(),
      type: CALLOUT_BLOCK,
      blocks,
      variant: node.getVariant(),
      spaceBefore,
      spaceAfter,
    };
    return [block];
  }
}
// #endregion flow-text
// #endregion flattener

// #region layouter
/** Flows callout inline text through one indented region per page. */
export class CalloutLayouter implements BlockLayouter {
  readonly type = CALLOUT_BLOCK;
  private context: EditorContext | null = null;

  /** Keep the editor context whose cascade supplies document-theme token overrides. */
  setContext(context: EditorContext | null): void {
    this.context = context;
  }

// #region resume
  layout(block: BlockInput, cursor: RegionCursor): LayoutResult {
    return this.place(block as CalloutBlock, STREAM_START, cursor);
  }

  resume(block: BlockInput, token: ResumeToken, cursor: RegionCursor): LayoutResult {
    // The core keeps resume tokens opaque at this seam; this layouter created StreamCursor tokens, so the cast restores its own cursor shape.
    return this.place(block as CalloutBlock, token as StreamCursor, cursor);
  }
// #endregion resume

// #region open-region
  private place(callout: CalloutBlock, from: StreamCursor, cursor: RegionCursor): LayoutResult {
    const indent = calloutIndent(this.context, callout.variant);
    const region = cursor.open({
      // The anchor keeps the region at the current flow position; offsetTop aligns its top with that position, and offsetLeft reserves space beside the rail.
      role: "callout",
      width: cursor.width() - indent,
      anchor: "top",
      offsetTop: cursor.currentY(),
      offsetLeft: indent,
      // A null fixedHeight lets the stream determine the region height and break it across pages.
      fixedHeight: null,
      nodeKey: callout.key,
      data: { variant: callout.variant, indent },
      // The signature participates in painted-page reuse, so include values that change the renderer's output.
      sig: `${callout.variant}:${indent}`,
    });
    return region.fill(callout.blocks, from);
  }
// #endregion open-region
}
// #endregion layouter

// #region renderer
/** Paints the callout band and rail below selection, then fills text above it. */
export class CalloutRenderer implements RegionRenderer {
// #region claims
  claims(region: Region): boolean {
    return region.role === "callout";
  }
// #endregion claims

  render(
    region: Region,
    regionX: number,
    regionY: number,
    host: HTMLElement,
    hostX: number,
    hostY: number,
    ctx: RegionRenderContext,
  ): HTMLElement {
    const data = region.data as CalloutRegionData | undefined;
    const variant = data?.variant ?? "note";
    const indent = data?.indent ?? DEFAULT_CALLOUT_INDENT_PX;

    // #region paint-band-rail
    // Chrome is painted below the selection layer so the band and rail remain decoration behind editable text.
    const band = document.createElement("div");
    band.className = "pg-callout-band";
    band.dataset.calloutVariant = variant;
    band.style.position = "absolute";
    band.style.left = `${regionX - indent}px`;
    band.style.top = `${regionY}px`;
    band.style.width = `${region.width + indent}px`;
    band.style.height = `${region.height}px`;
    ctx.chrome.appendChild(band);

    const rail = document.createElement("div");
    rail.className = "pg-callout-rail";
    rail.dataset.calloutVariant = variant;
    rail.style.position = "absolute";
    rail.style.left = `${regionX - indent}px`;
    rail.style.top = `${regionY}px`;
    rail.style.height = `${region.height}px`;
    ctx.chrome.appendChild(rail);
    // #endregion paint-band-rail

    // #region paint-text
    // The content wrapper belongs to the host layer above chrome, so the editor can keep text selection and caret painting interactive.
    const content = document.createElement("div");
    content.className = "pg-callout-content";
    content.dataset.calloutVariant = variant;
    content.style.position = "absolute";
    content.style.left = `${regionX - hostX}px`;
    content.style.top = `${regionY - hostY}px`;
    content.style.width = `${region.width}px`;
    content.style.height = `${region.height}px`;
    host.appendChild(content);
    ctx.fill(region, content, regionX, regionY);
    return content;
    // #endregion paint-text
  }
}
// #endregion renderer
