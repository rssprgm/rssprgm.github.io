import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";

const source = readFileSync("join-dialog.js", "utf8")
  .replace(/^import .*;\n/, "")
  .replace("export function setupJoinDialog", "function setupJoinDialog");

test("join deep links open, close, and reopen the existing dialog", () => {
  class Element extends EventTarget {
    dataset = {};
    style = {};
    value = "";
    hidden = false;
    open = false;
    showCount = 0;
    children = new Map();
    classList = {
      values: new Set(),
      contains(value) { return this.values.has(value); },
      add(value) { this.values.add(value); },
      remove(value) { this.values.delete(value); },
    };
    querySelector(selector) {
      if (!this.children.has(selector)) this.children.set(selector, new Element());
      return this.children.get(selector);
    }
    querySelectorAll() { return []; }
    setAttribute() {}
    removeAttribute() {}
    setCustomValidity() {}
    focus() { this.focused = true; }
    showModal() { this.open = true; this.showCount++; }
    close() { this.open = false; }
  }
  const root = new Element();
  root.querySelector("[data-join-form]").elements = {
    grade: new Element(), student_number: new Element(), personal_email: new Element(),
  };
  const trigger = new Element();
  const window = new EventTarget();
  window.location = new URL("https://rssprgm.github.io/meetings.html?src=poster#faq");
  window.history = {
    state: { existing: true },
    replaceState(state, unused, url) {
      assert.equal(state, this.state);
      window.location = new URL(url);
    },
  };
  window.scrollY = 120;
  window.scrollTo = () => {};
  window.turnstile = { render: () => 1, remove() {}, reset() {} };
  const context = vm.createContext({
    window, document: { body: new Element() }, URL,
    HTMLElement: Element, HTMLDialogElement: Element, HTMLFormElement: Element,
    HTMLSelectElement: Element, HTMLInputElement: Element, HTMLButtonElement: Element,
    createStaggeredTextRenderer: () => () => {},
    requestAnimationFrame: (callback) => callback(), root, trigger,
  });
  vm.runInContext(source, context);
  const setup = () => vm.runInContext(
    "setupJoinDialog({ root, triggers: [trigger], prefersReducedMotion: true })", context,
  );
  const navigate = (hash) => {
    const event = new Event("hashchange");
    event.oldURL = window.location.href;
    window.location.hash = hash;
    window.dispatchEvent(event);
  };
  setup();
  assert.equal(root.open, false, "ordinary anchors must not open the sheet");
  navigate("#join");
  assert.equal(root.open, true);
  assert.equal(root.showCount, 1);
  navigate("#join");
  assert.equal(root.showCount, 1, "same hash must not reset an open form");
  navigate("#faq");
  assert.equal(root.open, false, "leaving #join closes the sheet");
  assert.equal(window.location.hash, "#faq");
  navigate("#join");
  root.dispatchEvent(new Event("cancel", { cancelable: true }));
  assert.equal(root.open, false);
  assert.equal(window.location.href, "https://rssprgm.github.io/meetings.html?src=poster");
  assert.equal(trigger.focused, true);
  navigate("#join");
  assert.equal(root.open, true, "the same deep link works after dismissal");
  root.close();
  setup();
  assert.equal(root.open, true, "loading a page at #join opens the sheet immediately");
});
