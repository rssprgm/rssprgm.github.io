import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const resourcesPage = readFileSync("resources.html", "utf8");
const resourcesInclude = readFileSync("_includes/resource-list.html", "utf8");
const resourcesData = readFileSync("_data/resources.yml", "utf8");

test("resources render from Jekyll data", () => {
  assert.match(
    resourcesPage,
    /{% include resource-list\.html categories=site\.data\.resources %}/,
  );
  assert.match(resourcesInclude, /{% for category in resource_categories %}/);
  assert.match(resourcesInclude, /{% for resource in category\.items %}/);
});

test("every resource has a standalone icon", () => {
  const icons = [...resourcesData.matchAll(/^\s+icon: (\S+)$/gm)].map(
    ([, icon]) => icon,
  );

  assert.equal(icons.length, 13);
  assert.equal(new Set(icons).size, icons.length);

  icons.forEach((icon) => {
    assert.ok(existsSync(`assets/icons/resources/${icon}.svg`), icon);
  });
});
