const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const index = readFileSync(join(root, 'index.ts'), 'utf8');
const docs = readFileSync(join(root, 'playground/src/Docs.jsx'), 'utf8');
const topics = readFileSync(join(root, 'playground/src/doc-topics.js'), 'utf8');

// Keep the hand-authored API reference in sync when the library export surface grows.
test('playground docs provide a navigable article for every runtime and type export', () => {
    const runtime = Object.keys(require('../dist/index.js'));
    const typeBlock = [...index.matchAll(/export type\s*\{([^}]+)\}/g)]
        .flatMap(([, entries]) => entries.split(',').map(entry => entry.trim()).filter(Boolean));
    const typeAliases = [...index.matchAll(/export type\s+(\w+)\s*=/g)].map(([, name]) => name);
    const types = [...typeAliases, ...typeBlock];

    assert.equal(runtime.length, 8, 'Update the docs coverage test when adding a runtime export');
    assert.equal(types.length, 5, 'Update the docs coverage test when adding a type export');
    for (const name of [...runtime, ...types]) {
        assert.ok(topics.includes(`['${name}', '${name}']`), `${name} must have a navigation entry`);
        assert.ok(docs.includes(`  ${name}: {`), `${name} must have a documentation article`);
    }
});
