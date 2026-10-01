const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveSchemaByPointer, setSchemaByPointer } = require('../dist/index.js');

const baseURI = 'https://example.test/root.json';

test('opt-in schema write follows a local reference and snapshots the physical old value', async () => {
    const schema = { $id: baseURI, $defs: { target: { title: { nested: [1] } } },
        properties: { name: { $ref: '#/$defs/target' } } };
    const old = await setSchemaByPointer({ nested: [2] }, '/properties/name/title', schema, { baseURI });
    assert.deepEqual(old, { nested: [1] });
    old.nested[0] = 10;
    assert.deepEqual(schema.$defs.target.title, { nested: [2] });
    assert.deepEqual(schema.properties.name, { $ref: '#/$defs/target' });
    assert.equal((await resolveSchemaByPointer('/properties/name/title/nested/0', schema, { baseURI })).value, 2);
});

test('schema edits performed as ordinary raw data never dereference', async () => {
    const { setByPointer } = require('../dist/index.js');
    const schema = { $id: baseURI, properties: { name: { $ref: '#/$defs/target' } }, $defs: { target: { type: 'string' } } };
    assert.equal(setByPointer('updated', '/properties/name/$ref', schema), '#/$defs/target');
    assert.equal(schema.properties.name.$ref, 'updated');
    assert.equal(schema.$defs.target.type, 'string');
});

test('external write requires matching mutable registry AND authorization', async () => {
    const resourceURI = 'https://example.test/external.json';
    const schema = { $id: baseURI, properties: { a: { $ref: 'external.json#/$defs/item' } } };
    const external = { $id: resourceURI, $defs: { item: { title: 'before' } } };
    const loadResource = async () => external;
    const pointer = '/properties/a/title';
    const basic = { baseURI, loadResource };
    await assert.rejects(setSchemaByPointer('after', pointer, schema, basic), /authorized/);
    await assert.rejects(setSchemaByPointer('after', pointer, schema, {
        ...basic, authorizeExternalWrite: () => true
    }), /authorized/);
    await assert.rejects(setSchemaByPointer('after', pointer, schema, {
        ...basic, mutableResources: new Map([[resourceURI, external]]), authorizeExternalWrite: () => false
    }), /authorized/);
    await assert.rejects(setSchemaByPointer('after', pointer, schema, {
        ...basic, mutableResources: new Map([[resourceURI, { ...external }]]), authorizeExternalWrite: () => true
    }), /authorized/);
    assert.equal(external.$defs.item.title, 'before');
    const prior = await setSchemaByPointer('after', pointer, schema, {
        ...basic, mutableResources: new Map([[resourceURI, external]]), authorizeExternalWrite: target =>
            target.documentURI === resourceURI && target.documentPath === '/$defs/item/title'
    });
    assert.equal(prior, 'before');
    assert.equal(external.$defs.item.title, 'after');
});

test('rejects root and computed-key writes without mutation', async () => {
    const schema = { $id: baseURI, prefixItems: [true, false] };
    await assert.rejects(setSchemaByPointer(false, '#', schema, { baseURI }), /root/);
    await assert.rejects(setSchemaByPointer(0, ['/prefixItems/1', '0#'], schema, { baseURI }), /computed/);
    assert.deepEqual(schema.prefixItems, [true, false]);
});

test('authorization cannot redirect a write by replacing the resolved parent', async () => {
    const resourceURI = 'https://example.test/external.json';
    const schema = { $id: baseURI, properties: { item: { $ref: 'external.json#/$defs/target' } } };
    const external = { $id: resourceURI, $defs: { target: { type: 'string' } } };
    await assert.rejects(setSchemaByPointer('number', '/properties/item/type', schema, {
        baseURI,
        loadResource: async () => external,
        mutableResources: new Map([[resourceURI, external]]),
        authorizeExternalWrite: () => { external.$defs.target = { type: 'boolean' }; return true; }
    }), /changed/);
    assert.equal(external.$defs.target.type, 'boolean');
});

test('authorization cannot overwrite a leaf changed while approval was pending', async () => {
    const resourceURI = 'https://example.test/external.json';
    const schema = { $id: baseURI, properties: { item: { $ref: 'external.json#/$defs/target' } } };
    const external = { $id: resourceURI, $defs: { target: { type: 'string' } } };
    await assert.rejects(setSchemaByPointer('number', '/properties/item/type', schema, {
        baseURI, loadResource: async () => external,
        mutableResources: new Map([[resourceURI, external]]),
        authorizeExternalWrite: () => { external.$defs.target.type = 'boolean'; return true; }
    }), /changed/);
    assert.equal(external.$defs.target.type, 'boolean');
});