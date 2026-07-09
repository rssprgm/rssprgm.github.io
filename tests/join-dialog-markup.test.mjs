import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const joinDialog = readFileSync("join-dialog.js", "utf8");
const joinDialogMarkup = readFileSync("_includes/join-dialog.html", "utf8");
const pages = ["index.html", "resources.html"].map((path) => ({
  path,
  source: readFileSync(path, "utf8"),
}));

test("each Jekyll page uses the shared navigation and join dialog includes", () => {
  pages.forEach(({ path, source }) => {
    assert.match(source, /^---\nis_home: (true|false)\n---/);
    assert.match(source, /{% include site-header\.html %}/, path);
    assert.match(source, /{% include mobile-menu\.html %}/, path);
    assert.match(source, /{% include join-dialog\.html %}/, path);
  });
});

test("the shared join include exposes one native dialog contract", () => {
  assert.equal(
    (joinDialogMarkup.match(/id="join-dialog"/g) || []).length,
    1,
    "the shared include must own exactly one join dialog root",
  );
  assert.match(
    joinDialogMarkup,
    /<dialog[\s\S]*class="join-overlay"[\s\S]*data-join-dialog/,
  );
  assert.doesNotMatch(
    joinDialogMarkup,
    /<dialog[^>]*\b(?:role|aria-modal|tabindex)=/,
  );

  [
    "data-join-form",
    "data-join-success",
    "data-join-grade-value",
    "data-join-personal-email-message",
    "data-join-turnstile",
    "data-close-join",
    'name="student_number"',
    'name="personal_email"',
    'name="interest"',
    'name="website"',
    "autofocus",
  ].forEach((hook) => {
    assert.ok(joinDialogMarkup.includes(hook), `missing join markup hook: ${hook}`);
  });
});

test("the join controller uses native dialog lifecycle instead of runtime markup injection", () => {
  assert.doesNotMatch(joinDialog, /joinDialogHTML|createContextualFragment|document\.body\.append/);
  assert.doesNotMatch(joinDialog, /trapJoinFocus|getFocusableJoinElements/);
  assert.match(joinDialog, /joinDialog\.showModal\(\)/);
  assert.match(joinDialog, /joinDialog\.close\(\)/);
  assert.match(joinDialog, /joinDialog\.addEventListener\("cancel"/);
});
