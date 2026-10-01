const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveSchemaByPointer: resolve } = require('../dist/index.js');
const baseURI = 'https://example.test/root.json';
const options = { baseURI };

test('read-only raw sibling keywords coexist with reference following and physical parents', async () => {
    const root = { $id: baseURI, $defs: { target: { type: 'number' }, link: {
        $ref: '#/$defs/target', title: 'local'
    } } };
    const direct = await resolve('/$defs/link/title', root, options);
    assert.equal(direct.value, 'local');
    assert.equal(direct.hops.length, 0);
    assert.equal(direct.point.parent.obj, root.$defs.link);
    assert.equal((await resolve('/$defs/link/$ref', root, options)).value, '#/$defs/target');
    const target = await resolve('/$defs/link/type', root, options);
    assert.equal(target.value, 'number');
    assert.equal(target.path, '/$defs/target/type');
    assert.equal(target.documentPath, '/$defs/target/type');
    assert.equal(target.hops[0].fromDocumentPath, '/$defs/link');
    assert.strictEqual(target.point.parent.obj, root.$defs.target);
    const end = await resolve('/$defs/link', root, options);
    assert.strictEqual(end.value, root.$defs.target);
    assert.deepEqual(root.$defs.link, { $ref: '#/$defs/target', title: 'local' });
});

test('embedded resource IDs, nested bases, anchors, escaped and percent-encoded fragments', async () => {
    const root = { $id: baseURI, $defs: {
        embedded: { $id: 'sub/other.json', $defs: {
            one: { $anchor: 'one', type: 'string' }, inner: { $id: 'nested.json', $anchor: 'inner', type: 'integer' }
        }, properties: { ref: { $ref: '#one' }, deep: { $ref: 'nested.json#inner' } } },
        name: { $anchor: 'n', type: 'null' },
        cross: { $ref: 'sub/other.json#/$defs/one' },
        rootAnchor: { $ref: '#n' },
        escaped: { $ref: '#/$defs/a~1b' },
        'a/b': { title: 'slash' },
        percent: { $ref: '#/$defs/a%25b' }, 'a%b': true
    } };
    const embedded = await resolve('/$defs/embedded/properties/ref', root, options);
    assert.equal(embedded.resourceURI, 'https://example.test/sub/other.json');
    assert.equal(embedded.path, '/$defs/one');
    assert.equal(embedded.documentPath, '/$defs/embedded/$defs/one');
    assert.equal((await resolve('/$defs/cross/type', root, options)).value, 'string');
    assert.equal((await resolve('/$defs/embedded/properties/deep/type', root, options)).value, 'integer');
    assert.equal((await resolve('/$defs/rootAnchor/type', root, options)).value, 'null');
    assert.equal((await resolve('/$defs/escaped/title', root, options)).value, 'slash');
    assert.equal((await resolve('/$defs/percent', root, options)).value, true);
});

test('root, empty member, boolean schemas and relative navigation from resolved leaflet', async () => {
    const root = { $id: baseURI, $defs: { '': { type: 'string' } },
        prefixItems: [true, false], allOf: [{ $ref: '#/$defs/' }, { type: 'integer' }] };
    assert.strictEqual((await resolve('', root, options)).value, root);
    assert.equal((await resolve('/allOf/0/type', root, options)).value, 'string');
    assert.equal((await resolve('/prefixItems/1', root, options)).value, false);
    const first = await resolve('/allOf/1', root, options);
    assert.equal((await resolve('0/type', root, { ...options, from: first })).value, 'integer');
    assert.equal((await resolve('0#', root, { ...options, from: first })).value, 1);
    assert.equal((await resolve(['/prefixItems/1', '0-1'], root, options)).value, true);
    await assert.rejects(resolve('/prefixItems/-', root, options));
    await assert.rejects(resolve('/prefixItems/01', root, options));
    await assert.rejects(resolve('/$defs/missing', root, options));
});

test('external resources load only through caller; cache, URI resolution and no silent network', async () => {
    const root = { $id: baseURI, properties: { a: { $ref: '../external.json#item' },
        b: { $ref: '../external.json#item' } } };
    await assert.rejects(resolve('/properties/a', root, options), /No loader/);
    const requests = [];
    const loader = async u => { requests.push(u); return { $id: u, $defs: { inner: {
        $anchor: 'item', type: 'boolean'
    } } }; };
    const result = await resolve('/properties/a/type', root, { ...options, loadResource: loader });
    assert.equal(result.value, 'boolean');
    assert.deepEqual(requests, ['https://example.test/external.json']);
    assert.equal(result.resourceURI, 'https://example.test/external.json');
    assert.equal(result.documentPath, '/$defs/inner/type');
    assert.equal(result.hops[0].staticURI, 'https://example.test/external.json#item');
    await assert.rejects(resolve('/properties/b', root, { ...options, maxLoads: 0, loadResource: loader }), /load limit/);
    assert.deepEqual(requests, ['https://example.test/external.json']);
});

test('dynamic ref statically resolves first; outermost matching resource overrides only a dynamic anchor', async () => {
    const tree = { $id: 'https://example.test/tree', $dynamicAnchor: 'node', type: 'array',
        items: { $dynamicRef: '#node' }, $defs: { plain: { $anchor: 'plain', type: 'null' },
            usePlain: { $dynamicRef: '#plain' }, ptr: { $dynamicRef: '#/$defs/plain' } } };
    const strict = { $id: 'https://example.test/strict', $dynamicAnchor: 'node',
        $ref: 'tree', unevaluatedProperties: false };
    const loaded = async u => u === 'https://example.test/tree' ? tree : null;
    const result = await resolve('/items', tree, { baseURI: tree.$id,
        dynamicScope: ['https://example.test/strict', tree.$id],
        loadResource: async u => u === strict.$id ? strict : loaded(u), maxHops: 4 });
    const finite = await resolve('/items', tree, { baseURI: tree.$id, dynamicScope: [strict.$id],
        loadResource: async u => u === strict.$id ? strict : loaded(u), maxHops: 2 });
    assert.strictEqual(finite.value, tree);
    await assert.rejects(resolve('/items', tree, { baseURI: tree.$id, dynamicScope: [strict.$id],
        loadResource: async u => u === strict.$id ? strict : loaded(u), maxHops: 1 }), /hop limit/i);
    assert.equal(result.hops[0].targetURI, strict.$id + '#node');
    assert.equal(result.hops[0].staticURI, tree.$id + '#node');
    assert.equal((await resolve('/$defs/usePlain', tree, { baseURI: tree.$id,
        dynamicScope: [strict.$id], loadResource: async u => u === strict.$id ? strict : loaded(u) })).value.type, 'null');
    assert.equal((await resolve('/$defs/ptr', tree, { baseURI: tree.$id,
        dynamicScope: [strict.$id], loadResource: async u => u === strict.$id ? strict : loaded(u) })).value.type, 'null');
});

test('bounded reference cycles and malformed input fail closed', async () => {
    const root = { $id: baseURI, $defs: { a: { $ref: '#/$defs/b' }, b: { $ref: '#/$defs/a' },
        bad: { $ref: 'https://example.test/x#%zz' } } };
    await assert.rejects(resolve('/$defs/a', root, options), /cycle/);
    await assert.rejects(resolve('/$defs/a', root, { ...options, maxHops: 1 }), /hop limit/);
    await assert.rejects(resolve('/$defs/bad', root, options), /percent escape/);
    await assert.rejects(resolve('/$defs/a~2', root, options), /escape/);
    const hostile = JSON.parse('{"$id":"https://example.test/root.json","$defs":{"__proto__":{"type":"string"}}}');
    await assert.rejects(resolve('/$defs/__proto__', hostile, options), /Unsafe/);
});

test('duplicate resource IDs, ambiguous refs, getters and index exhaustion are rejected', async () => {
    await assert.rejects(resolve('', { $id: baseURI, $defs: {
        a: { $id: 'duplicate', type: 'string' }, b: { $id: 'duplicate', type: 'number' }
    } }, options), /Duplicate/);
    await assert.rejects(resolve('/$defs/a', { $id: baseURI, $defs: {
        a: { $ref: '#', $dynamicRef: '#' }
    } }, options), /Ambiguous/);
    const withGetter = { $id: baseURI, properties: {} };
    Object.defineProperty(withGetter.properties, 'unsafe', { enumerable: true, get() { throw Error('executed'); } });
    await assert.rejects(resolve('', withGetter, options), /accessors/);
    let deep = true;
    for (let i = 0; i < 130; i++) deep = { not: deep };
    await assert.rejects(resolve('', deep, options), /index limit/);
});

test('a resolved leaflet can carry ordered scope and physical parents to the next call', async () => {
    const root = { $id: baseURI, $defs: { one: { $id: 'one.json', $dynamicAnchor: 'node',
        properties: { next: { $dynamicRef: '#node' } } } } };
    const from = await resolve('/$defs/one/properties', root, options);
    assert.equal(from.resourceURI, 'https://example.test/one.json');
    assert.deepEqual(from.dynamicScope, [baseURI, 'https://example.test/one.json']);
    const next = await resolve('0/next', root, { ...options, from });
    assert.equal(next.resourceURI, 'https://example.test/one.json');
    assert.equal(next.hops[0].targetURI, 'https://example.test/one.json#node');
    assert.equal((await resolve('0#', root, { ...options, from })).value, 'properties');
});

test('external leaflets retain their own document for relative siblings', async () => {
    const root = { $id: baseURI, $ref: 'external.json#/$defs/items/prefixItems/0' };
    const external = { $id: 'https://example.test/external.json', $defs: {
        items: { prefixItems: [{ type: 'string' }, { type: 'number' }] }
    } };
    const leaf = await resolve('', root, { ...options, loadResource: async () => external });
    const next = await resolve('0+1/type', root, { ...options, from: leaf });
    assert.equal(next.value, 'number');
    assert.equal(next.documentURI, external.$id);
    assert.equal(next.documentPath, '/$defs/items/prefixItems/1/type');
    await assert.rejects(resolve('0+1/type', root, { ...options, from: { ...leaf, value: {} } }), /Stale/);
});