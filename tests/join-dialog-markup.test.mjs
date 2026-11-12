import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const joinDialog = readFileSync("join-dialog.js", "utf8");
const joinDialogMarkup = readFileSync("_includes/join-dialog.html", "utf8");
const defaultLayout = readFileSync("_layouts/default.html", "utf8");
const pages = ["index.html", "resources.html", "meetings.html", "meetings/git.html", "meetings/introduction.html"].map((path) => ({
  path,
  source: readFileSync(path, "utf8"),
}));

test("each Jekyll page uses the shared layout contract", () => {
  pages.forEach(({ path, source }) => {
    assert.match(source, /^---\n[\s\S]*layout: default[\s\S]*is_home: (true|false)\n---/);
    assert.match(source, /^title: .+$/m, path);
    assert.match(source, /^description: .+$/m, path);
    assert.match(source, /^canonical_path: .+$/m, path);
  });

  assert.match(defaultLayout, /{% include site-header\.html %}/);
  assert.match(defaultLayout, /{% include mobile-menu\.html %}/);
  assert.match(defaultLayout, /{% include join-dialog\.html %}/);
  assert.match(defaultLayout, /{% include site-footer\.html %}/);
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

test("shared navigation points to the meetings page", () => {
  const header = readFileSync("_includes/site-header.html", "utf8");
  const mobileMenu = readFileSync("_includes/mobile-menu.html", "utf8");

  [header, mobileMenu].forEach((source) => {
    assert.match(source, /assign meetings_url = '\/meetings\.html' \| relative_url/);
    assert.match(source, /href="{{ meetings_url }}"/);
  });
});


test("meeting metadata lives only in About and thumbnail links retain accessible titles", () => {
  const detail = readFileSync("_includes/meeting-detail.html", "utf8");
  assert.equal((detail.match(/<h1\b/g) || []).length, 1);
  assert.ok(detail.indexOf('<h1') > detail.indexOf('data-panel="about"'));
  assert.ok(detail.indexOf('<h1') < detail.indexOf('data-panel="summary"'));
  assert.doesNotMatch(detail.slice(0, detail.indexOf('meeting-watch')), /<h1|<time/);
  const catalogue = readFileSync("meetings.html", "utf8");
  assert.match(catalogue, /aria-label="{{ workshop.title \| escape }}"/);
  assert.doesNotMatch(catalogue, /<h[23]/);
  pages.forEach(({ source }) => assert.doesNotMatch(source, /include site-footer/));
});
