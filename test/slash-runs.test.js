import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { parse } from "../index.js";

test("boundary slashes preserve normalization and missing-type errors", () => {
  assert.deepEqual(parse("pkg:////generic/foo///#///a//b///"), parse("pkg:generic/foo#a/b"));
  assert.equal(parse("pkg:generic/foo#////").subpath, null);
  assert.throws(() => parse("pkg:////"), { code: "E_MISSING_TYPE" });
  assert.throws(() => parse("pkg:generic////"), { code: "E_MISSING_NAME" });
});

for (const component of ["path", "subpath"]) {
  test(`long internal slash runs in ${component} finish without backtracking`, () => {
    // A child-process deadline can interrupt a synchronous regex stall. The
    // linear parser completes this 1 MB input far below the generous deadline.
    const code = `
      import assert from "node:assert/strict";
      import { parse } from ${JSON.stringify(new URL("../index.js", import.meta.url).href)};
      const run = "/".repeat(1_000_000);
      const result = parse(${JSON.stringify(component)} === "path"
        ? "pkg:generic/foo" + run + "x"
        : "pkg:generic/foo#a" + run + "x");
      assert.equal(result.name, ${JSON.stringify(component === "path" ? "x" : "foo")});
      ${component === "subpath" ? 'assert.equal(result.subpath, "a/x");' : 'assert.equal(result.namespace, "foo");'}
    `;
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
      encoding: "utf8", timeout: 5000
    });
    assert.ifError(child.error);
    assert.equal(child.status, 0, child.stderr);
  });
}
