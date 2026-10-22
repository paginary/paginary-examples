import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { createEditor, $createParagraphNode, $createRangeSelection, $createTextNode, $getRoot, $isElementNode, $setSelection } from "lexical";
import { fillTemplate } from "@paginary/core/headless";
import type { DocumentTheme, EditorContext } from "@paginary/core";
import {
  $createCalloutNode,
  $isCalloutNode,
  CALLOUT_SLICE,
  CalloutExtension,
  CalloutNode,
  SET_CALLOUT_VARIANT,
  TURN_INTO_CALLOUT,
} from "../src/index.ts";
import { calloutIndent } from "../src/calloutLayout.ts";

type FixtureNode = { readonly type: string; readonly text?: string; readonly children?: readonly FixtureNode[] };

type FixtureFile = { readonly document: { readonly root: { readonly children: readonly FixtureNode[] } } };

const extensionContext = (
  editor: ReturnType<typeof createEditor>,
  notices: Array<Parameters<EditorContext["notify"]>[0]>,
  documentTheme: DocumentTheme = { name: "test", overrides: {} },
): EditorContext => ({
  editor,
  documentTheme,
  notify: (notice: Parameters<EditorContext["notify"]>[0]) => notices.push(notice),
} as unknown as EditorContext);

test("constructs without a DOM", () => {
  assert.equal("document" in globalThis, false);
  assert.ok(new CalloutExtension());
});

test("warning exports a DOM element with its variant", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const runtime = globalThis as unknown as { document?: Document; HTMLElement?: typeof HTMLElement };
  const previousDocument = runtime.document;
  const previousHTMLElement = runtime.HTMLElement;
  runtime.document = dom.window.document;
  runtime.HTMLElement = dom.window.HTMLElement;
  try {
    const editor = createEditor({ namespace: "callout-dom", nodes: [CalloutNode], onError: (error) => { throw error; } });
    let element: unknown;
    editor.update(() => {
      const callout = $createCalloutNode("warning");
      $getRoot().clear().append(callout);
      element = callout.exportDOM(editor).element;
    }, { discrete: true });
    assert.ok(element instanceof dom.window.HTMLElement);
    assert.equal(element.getAttribute("class"), "pg-callout");
    assert.equal(element.getAttribute("data-callout-variant"), "warning");
  } finally {
    if (previousDocument === undefined) delete runtime.document;
    else runtime.document = previousDocument;
    if (previousHTMLElement === undefined) delete runtime.HTMLElement;
    else runtime.HTMLElement = previousHTMLElement;
  }
});

test("warning survives a JSON round trip", () => {
  const editor = createEditor({ namespace: "callout-json", nodes: [CalloutNode], onError: (error) => { throw error; } });
  let serialized: ReturnType<CalloutNode["exportJSON"]> | undefined;
  editor.update(() => {
    const callout = $createCalloutNode("warning");
    $getRoot().clear().append(callout);
    serialized = callout.exportJSON();
  }, { discrete: true });
  assert.ok(serialized);
  const serializedValue = serialized;
  editor.update(() => {
    const restored = CalloutNode.importJSON(serializedValue);
    assert.equal(restored.getVariant(), "warning");
  }, { discrete: true });
});

test("turns a paragraph into a callout and sets a themed variant, while refusing an unknown variant", () => {
  const extension = new CalloutExtension();
  const editor = createEditor({ namespace: "callout-commands", nodes: extension.nodes(), onError: (error) => { throw error; } });
  const notices: Array<Parameters<EditorContext["notify"]>[0]> = [];
  const ctx = extensionContext(editor, notices, {
    name: "test",
    overrides: {},
    variants: { callout: { themed: { "--pg-callout-bg": "#123456" } } },
  });
  const cleanup = extension.register(editor, ctx);

  editor.update(() => {
    const paragraph = $createParagraphNode();
    const text = $createTextNode("Convert me");
    paragraph.append(text);
    $getRoot().clear().append(paragraph);
    const selection = $createRangeSelection();
    selection.anchor.set(text.getKey(), 0, "text");
    selection.focus.set(text.getKey(), text.getTextContentSize(), "text");
    $setSelection(selection);
  }, { discrete: true });
  extension.commands()[TURN_INTO_CALLOUT](ctx);
  editor.update(() => {}, { discrete: true });
  editor.getEditorState().read(() => assert.equal($getRoot().getFirstChild()?.getType(), "example-callout"));

  editor.update(() => {
    const callout = $getRoot().getFirstChild();
    assert.ok($isCalloutNode(callout));
    const child = callout.getFirstChild();
    if ($isElementNode(child)) child.select();
  }, { discrete: true });
  extension.commands()[SET_CALLOUT_VARIANT](ctx, "themed");
  editor.update(() => {}, { discrete: true });
  editor.getEditorState().read(() => {
    const callout = $getRoot().getFirstChild();
    assert.ok($isCalloutNode(callout));
    assert.equal(callout.getVariant(), "themed");
  });

  extension.commands()[SET_CALLOUT_VARIANT](ctx, "unknown");
  assert.equal(notices[notices.length - 1]?.code, "PG-CALLOUT-VARIANT-INVALID");
  editor.getEditorState().read(() => {
    const callout = $getRoot().getFirstChild();
    assert.ok($isCalloutNode(callout));
    assert.equal(callout.getVariant(), "themed");
  });
  assert.equal(extension.selectionSlice(ctx)?.variant, "themed");
  assert.equal(CALLOUT_SLICE.extension, "callout");
  cleanup();
});

test("fixture callout holds its text directly", () => {
  const fixture = JSON.parse(readFileSync(new URL("./callout-document.json", import.meta.url), "utf8")) as FixtureFile;
  const callout = fixture.document.root.children.find(({ type }) => type === "example-callout");
  assert.ok(callout);
  assert.equal(callout.children?.length, 1);
  assert.equal(callout.children?.[0]?.type, "text");
  assert.equal(callout.children?.[0]?.text, "Read this warning");
});

test("resolves the callout indent from the variant theme", () => {
  type VariantScope = { readonly variant?: { readonly namespace: string; readonly name: string } };
  const scopes: VariantScope[] = [];
  const context = {
    cascade: (scope?: VariantScope) => {
      scopes.push(scope ?? {});
      return { value: (_token: string): string => scope?.variant?.name === "warning" ? "48px" : "24px" };
    },
  } as unknown as EditorContext;

  assert.equal(calloutIndent(context, "warning"), 48);
  assert.equal(calloutIndent(context, "note"), 24);
  assert.deepEqual(scopes, [
    { variant: { namespace: "callout", name: "warning" } },
    { variant: { namespace: "callout", name: "note" } },
  ]);
});

test("declares callout tokens, layout cost, role, and warning variant CSS", () => {
  const extension = new CalloutExtension();
  assert.deepEqual(extension.themeTokens(), [
    { name: "--pg-callout-bg", value: "#eff6ff", label: "Callout background" },
    { name: "--pg-callout-accent", value: "#3b82f6", label: "Callout accent" },
    { name: "--pg-callout-indent", value: "24px", label: "Callout indent", affectsLayout: true },
  ]);
  assert.deepEqual(extension.themeRoles(), [{ name: "callout", namespace: "text", continuousSelector: ".pg-callout", default: {} }]);
  const css = extension.variantProjection(
    { name: "warning", overrides: {}, variants: { callout: { warning: { "--pg-callout-bg": "#fed7aa" } } } },
    "[data-pg-theme=\"test\"]",
  );
  assert.match(css, /\[data-callout-variant=\"warning\"\]/);
  assert.match(css, /--pg-callout-bg: #fed7aa/);
});

test("headless filling reopens the callout document", () => {
  const extension = new CalloutExtension();
  assert.deepEqual(extension.capabilities().nodes?.[0]?.fields, ["variant"]);
  const document = readFileSync(new URL("./callout-document.json", import.meta.url), "utf8");
  const result = fillTemplate({ extensions: [extension], document });
  assert.equal(result.ok, true);
  assert.deepEqual(result.report, { unresolved: [], invalid: [], findings: [] });
});
