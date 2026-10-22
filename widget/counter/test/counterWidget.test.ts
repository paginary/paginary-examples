import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { createEditor, $createParagraphNode, $createTextNode, $getRoot, $isElementNode } from "lexical";
import { $createWidgetNode, $isWidgetNode, WidgetNode, type EditorContext, type SelectionInfo } from "@paginary/core";
import { fillTemplate } from "@paginary/core/headless";
import { WidgetHarness } from "@paginary/core/testing";
import { counterWidget, CounterWidgetExtension, INSERT_COUNTER } from "../src/counterWidget.ts";

// The one page setup block an author needs for Node mount tests.
const document = new JSDOM("<!doctype html><html><body></body></html>").window.document;

const harness = (): WidgetHarness => new WidgetHarness({ widget: counterWidget });

test("the extension command inserts a counter at the selection", () => {
  const editor = createEditor({ namespace: "counter-command", nodes: [WidgetNode], onError: (error: unknown) => { throw error; } });
  editor.update(() => {
    const paragraph = $createParagraphNode().append($createTextNode("Before"));
    $getRoot().clear().append(paragraph);
    paragraph.selectEnd();
  }, { discrete: true });

  const command = new CounterWidgetExtension().commands()[INSERT_COUNTER];
  command({ selectAt: () => true, selection: { kind: "caret" }, editor } as unknown as EditorContext);
  editor.update(() => {}, { discrete: true });

  editor.getEditorState().read(() => {
    const paragraph = $getRoot().getFirstChild();
    assert.ok(paragraph);
    assert.ok($isElementNode(paragraph));
    const children = paragraph.getChildren();
    const inserted = children[children.length - 1];
    assert.ok(inserted);
    assert.ok($isWidgetNode(inserted));
    assert.equal(inserted.getWidgetType(), "example.counter");
  });
});

test("the extension command refuses without a selection", () => {
  const extension = new CounterWidgetExtension();
  const notices: unknown[] = [];
  const context = {
    selectAt: () => false,
    notify: (notice: unknown) => notices.push(notice),
    editor: { update: () => { throw new Error("the refused command must not update"); } },
  } as unknown as EditorContext;

  assert.equal(extension.commandEnabled(INSERT_COUNTER, { kind: "none" } as SelectionInfo, context), false);
  extension.commands()[INSERT_COUNTER](context);
  assert.deepEqual(notices, [{
    source: "example-counter",
    code: "PG-COUNTER-INSERT-UNSUPPORTED",
    severity: "refuse",
    detail: "Cannot insert a counter: the editor has no selection.",
  }]);

  const nonTextNotices: unknown[] = [];
  const nonTextContext = {
    selectAt: () => true,
    selection: { kind: "nodes" },
    notify: (notice: unknown) => nonTextNotices.push(notice),
    editor: { update: () => { throw new Error("the non-text command must not update"); } },
  } as unknown as EditorContext;
  assert.equal(extension.commandEnabled(INSERT_COUNTER, { kind: "nodes" } as SelectionInfo, nonTextContext), false);
  extension.commands()[INSERT_COUNTER](nonTextContext);
  assert.deepEqual(nonTextNotices, [{
    source: "example-counter",
    code: "PG-COUNTER-INSERT-UNSUPPORTED",
    severity: "refuse",
    detail: "Cannot insert a counter: select text or place the caret where it should be inserted.",
  }]);
});

test("derive publishes the current count", () => {
  const result = harness().derive({ count: 4 });
  assert.deepEqual(result, { kind: "value", value: { count: 4 } });
});

test("bake returns markup without a warning", () => {
  const result = harness().bake({ count: 4 }, { forms: ["markup"] });
  assert.equal(result.form?.form, "markup");
  assert.match(result.markup, />4</);
  assert.deepEqual(result.warnings, []);
});

test("bake returns an accessible image without a warning", () => {
  const result = harness().bake({ count: 4 }, { forms: ["image"] });
  assert.equal(result.form?.form, "image");
  assert.equal(result.assets.length, 1);
  assert.match(result.markup, /Counter showing 4/);
  assert.deepEqual(result.warnings, []);
});

test("migrate converts version one state to the current shape", () => {
  assert.deepEqual(harness().migrate(1, { value: 4 }), {
    kind: "migrated",
    from: 1,
    state: { count: 4 },
  });
});

test("mount uses a resolved step input", async () => {
  const mounted = harness().mount({ count: 0 }, { document, inputs: { step: 5 } });
  const output = mounted.element.querySelector<HTMLOutputElement>("[data-counter-count]");
  const button = mounted.element.querySelector<HTMLButtonElement>("button");
  assert.ok(output);
  assert.ok(button);
  assert.equal(button.textContent, "Add 5");
  button.click();
  await Promise.resolve();
  assert.equal(output.textContent, "5");
  assert.deepEqual(mounted.writes, [{ count: 5 }]);
  mounted.unmount();
});

test("mount defaults to one when the step input is unwired", async () => {
  const mounted = harness().mount({ count: 0 }, { document });
  const output = mounted.element.querySelector<HTMLOutputElement>("[data-counter-count]");
  const button = mounted.element.querySelector<HTMLButtonElement>("button");
  assert.ok(output);
  assert.ok(button);
  button.click();
  await Promise.resolve();
  assert.equal(output.textContent, "1");
  assert.deepEqual(mounted.writes, [{ count: 1 }]);
  mounted.unmount();
});

test("mount redraws after a click and records the state write", async () => {
  const mounted = harness().mount({ count: 0 }, { document });
  const output = mounted.element.querySelector<HTMLOutputElement>("[data-counter-count]");
  const button = mounted.element.querySelector<HTMLButtonElement>("button");
  assert.ok(output);
  assert.ok(button);
  assert.equal(output.textContent, "0");

  button.click();
  await Promise.resolve();
  button.click();
  await Promise.resolve();

  assert.equal(output.textContent, "2");
  assert.deepEqual(mounted.writes, [{ count: 1 }, { count: 2 }]);
  assert.deepEqual(mounted.state, { count: 2 });
  mounted.unmount();
});

test("mount disables the button in read-only mode", () => {
  const mounted = harness().mount({ count: 0 }, { document, readOnly: true });
  const button = mounted.element.querySelector<HTMLButtonElement>("button");
  assert.ok(button);
  assert.equal(button.disabled, true);
  mounted.unmount();
});

test("renderError explains a failed live render", () => {
  const failingWidget = {
    ...counterWidget,
    mount: () => {
      throw new Error("test failure");
    },
  };
  const mounted = new WidgetHarness({ widget: failingWidget }).mount({ count: 0 }, { document });
  assert.equal(mounted.element.textContent, "Counter failed to render: test failure");
  mounted.unmount();
});

test("unmount removes the widget interior", () => {
  const mounted = harness().mount({ count: 0 }, { document });
  mounted.unmount();
  assert.equal(mounted.element.childElementCount, 0);
});

test("a document holding a counter opens through fillTemplate", () => {
  const editor = createEditor({ namespace: "counter-template", nodes: [WidgetNode], onError: (error: unknown) => { throw error; } });
  editor.update(() => {
    const paragraph = $createParagraphNode().append($createTextNode("Counter:"));
    paragraph.append($createWidgetNode("example.counter", 2, 180, 64));
    $getRoot().clear().append(paragraph);
  }, { discrete: true });
  const documentFile = {
    format: "paginary.document" as const,
    formatVersion: 1,
    document: editor.getEditorState().toJSON(),
  };
  const extension = new CounterWidgetExtension();
  assert.deepEqual(extension.widgets().map(({ type }) => type), ["example.counter"]);
  const result = fillTemplate({ extensions: [extension], document: documentFile });
  assert.equal(result.ok, true);
  assert.deepEqual(result.report, { unresolved: [], invalid: [], findings: [] });
});
