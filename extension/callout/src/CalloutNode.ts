import {
  $createParagraphNode,
  $isLineBreakNode,
  ElementNode,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type ParagraphNode,
  type RangeSelection,
  type SerializedElementNode,
  type Spread,
} from "lexical";
import { $copyBlockFormatIndent } from "@lexical/selection";
import { $carryBlockDataOnTurnInto } from "@paginary/core";

export type CalloutVariant = "note" | "warning" | (string & {});
export type SerializedCalloutNode = Spread<{ variant: CalloutVariant }, SerializedElementNode>;

function copyCalloutAppearance(source: CalloutNode, destination: ElementNode): void {
  $copyBlockFormatIndent(source, destination);
  destination.setDirection(source.getDirection());
  destination.setStyle(source.getStyle());
}

// #region store-variant
/** A block container whose inline text is rendered as a themed callout so the variant travels with the content. */
export class CalloutNode extends ElementNode {
  private __variant: CalloutVariant;

  constructor(variant: CalloutVariant = "note", key?: NodeKey) {
    super(key);
    this.__variant = variant;
  }
// #endregion store-variant

  static getType(): string {
    return "example-callout";
  }

  static clone(node: CalloutNode): CalloutNode {
    return new CalloutNode(node.__variant, node.__key);
  }

  createDOM(_config: EditorConfig, _editor: LexicalEditor): HTMLElement {
    const dom = document.createElement("div");
    dom.className = "pg-callout";
    dom.dataset.calloutVariant = this.__variant;
    return dom;
  }

  updateDOM(prevNode: this, dom: HTMLElement, _config: EditorConfig): boolean {
    if (prevNode.__variant !== this.__variant) dom.dataset.calloutVariant = this.__variant;
    return false;
  }

  // #region accessors
  getVariant(): CalloutVariant {
    return this.getLatest().__variant;
  }

  setVariant(variant: CalloutVariant): void {
    this.getWritable().__variant = variant;
  }
  // #endregion accessors

  /**
   * Apply the callout's Enter behavior to a collapsed or ranged selection.
   *
   * Enter inserts a line-break child inside a non-empty callout. A second Enter on the resulting empty last line
   * removes that line and inserts a normal paragraph after the callout. Enter at the callout start inserts a
   * paragraph before it. An empty callout turns into a paragraph while carrying its block identity.
   */
  handleEnter(selection: RangeSelection): boolean {
    this.insertNewAfter(selection);
    return true;
  }

  /**
   * Supply the same block insertion behavior used by the Enter command to Lexical's paragraph and paste paths.
   *
   * A multiline paste calls this hook for each newline. Rich paste merges the callout's remaining text into the last pasted
   * paragraph, as a heading does, while keeping the pasted paragraphs in order. Typed Enter keeps the caret in this
   * callout and inserts a line break instead.
   */
  insertNewAfter(selection: RangeSelection, restoreSelection = true): CalloutNode | ParagraphNode | null {
    if (!selection.isCollapsed()) {
      selection.insertLineBreak(false);
      return this;
    }
    if (this.isEmpty()) {
      const paragraph = this.createParagraph();
      $carryBlockDataOnTurnInto(this, paragraph);
      this.replace(paragraph);
      if (restoreSelection) paragraph.select();
      return paragraph;
    }
    if (this.isEmptyLastLine(selection)) {
      this.getLastChild()?.remove();
      const paragraph = this.createParagraph();
      this.insertAfter(paragraph, restoreSelection);
      if (restoreSelection) paragraph.select();
      return paragraph;
    }
    if (!restoreSelection && this.isAtStart(selection)) {
      const trailingCallout = this.createCallout();
      trailingCallout.append(...this.getChildren());
      this.clear();
      this.insertAfter(trailingCallout, false);
      return trailingCallout;
    }
    if (!restoreSelection) {
      const callout = this.createCallout();
      this.insertAfter(callout, false);
      return callout;
    }
    if (this.isAtStart(selection)) {
      const paragraph = this.createParagraph();
      this.insertBefore(paragraph, true);
      paragraph.select();
      return paragraph;
    }
    selection.insertLineBreak(false);
    return this;
  }

  /** Allow block-level paste to place its first paragraph inside an empty callout. */
  canMergeWhenEmpty(): boolean {
    return true;
  }

  private createParagraph(): ParagraphNode {
    const paragraph = $createParagraphNode();
    copyCalloutAppearance(this, paragraph);
    return paragraph;
  }

  private createCallout(): CalloutNode {
    const callout = $createCalloutNode(this.getVariant());
    copyCalloutAppearance(this, callout);
    return callout;
  }

  private isAtStart(selection: RangeSelection): boolean {
    const point = selection.anchor;
    if (point.type === "element") return point.key === this.getKey() && point.offset === 0;
    const firstDescendant = this.getFirstDescendant();
    return firstDescendant !== null && point.key === firstDescendant.getKey() && point.offset === 0;
  }

  private isEmptyLastLine(selection: RangeSelection): boolean {
    const point = selection.anchor;
    return point.type === "element" && point.key === this.getKey() && point.offset === this.getChildrenSize() && $isLineBreakNode(this.getLastChild());
  }

  // #region json
  static importJSON(serialized: SerializedCalloutNode): CalloutNode {
    return new CalloutNode(serialized.variant).updateFromJSON(serialized);
  }

  exportJSON(): SerializedCalloutNode {
    return { ...super.exportJSON(), type: CalloutNode.getType(), version: 1, variant: this.__variant };
  }
  // #endregion json

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const output = super.exportDOM(editor);
    if (output.element instanceof HTMLElement) {
      output.element.className = "pg-callout";
      output.element.dataset.calloutVariant = this.__variant;
    }
    return output;
  }
}

/** Create a callout node with the note variant unless a variant is supplied. */
export function $createCalloutNode(variant: CalloutVariant = "note"): CalloutNode {
  return new CalloutNode(variant);
}

/** Narrow a Lexical node to the callout type owned by this example. */
export function $isCalloutNode(node: LexicalNode | null | undefined): node is CalloutNode {
  return node instanceof CalloutNode;
}
