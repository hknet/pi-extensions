import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

interface PackageManifest {
  engines?: { node?: string };
  files?: string[];
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  private?: boolean;
}

const manifests = [
  "package.json",
  "packages/pi-advisor/package.json",
  "packages/pi-thinking-command/package.json",
  "packages/pi-timestamp/package.json",
  "packages/pi-set-model/package.json",
] as const;

const expectedPeers: Record<(typeof manifests)[number], string[]> = {
  "package.json": ["@earendil-works/pi-ai", "@earendil-works/pi-coding-agent", "@earendil-works/pi-tui"],
  "packages/pi-advisor/package.json": ["@earendil-works/pi-ai", "@earendil-works/pi-coding-agent", "@earendil-works/pi-tui"],
  "packages/pi-thinking-command/package.json": ["@earendil-works/pi-ai", "@earendil-works/pi-coding-agent", "@earendil-works/pi-tui"],
  "packages/pi-timestamp/package.json": ["@earendil-works/pi-coding-agent", "@earendil-works/pi-tui"],
  "packages/pi-set-model/package.json": ["@earendil-works/pi-ai", "@earendil-works/pi-coding-agent", "@earendil-works/pi-tui"],
};

function readManifest(path: string): PackageManifest {
  return JSON.parse(readFileSync(path, "utf8")) as PackageManifest;
}

test("Pi SDK packages are optional wildcard peers supplied by the host", () => {
  for (const path of manifests) {
    const manifest = readManifest(path);
    assert.equal(manifest.engines?.node, ">=22.19.0", `${path} Node engine`);
    assert.deepEqual(Object.keys(manifest.peerDependencies ?? {}).sort(), expectedPeers[path], `${path} peer set`);
    for (const [name, range] of Object.entries(manifest.peerDependencies ?? {})) {
      assert.match(name, /^@earendil-works\/pi-(?:ai|coding-agent|tui)$/);
      assert.equal(range, "*", `${path} ${name} peer range`);
      assert.equal(manifest.peerDependenciesMeta?.[name]?.optional, true, `${path} ${name} optional peer`);
    }
  }
});

test("GitHub Actions dependencies are pinned to immutable commits", () => {
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
  assert.doesNotMatch(workflow, /uses:\s+actions\/(?:checkout|setup-node)@v\d+/);
  assert.match(workflow, /uses:\s+actions\/checkout@[0-9a-f]{40}\s+# v7/);
  assert.match(workflow, /uses:\s+actions\/setup-node@[0-9a-f]{40}\s+# v7/);
});

test("every package includes its changelog and the root cannot be published", () => {
  assert.equal(readManifest("package.json").private, true);
  for (const path of manifests) {
    assert.ok(readManifest(path).files?.includes("CHANGELOG.md"), `${path} files`);
  }
});
