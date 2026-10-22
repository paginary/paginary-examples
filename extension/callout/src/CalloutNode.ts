import {
  ElementNode,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
} from "lexical";

export type CalloutVariant = "note" | "warning" | (string & {});
export type SerializedCalloutNode = Spread<{ variant: CalloutVariant }, SerializedElementNode>;

// #region node
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
// #endregion node

/** Create a callout node with the note variant unless a variant is supplied. */
export function $createCalloutNode(variant: CalloutVariant = "note"): CalloutNode {
  return new CalloutNode(variant);
}

/** Narrow a Lexical node to the callout type owned by this example. */
export function $isCalloutNode(node: LexicalNode | null | undefined): node is CalloutNode {
  return node instanceof CalloutNode;
}
