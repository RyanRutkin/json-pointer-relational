const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getByPointer, getReferenceByPointer, setByPointer, setByPointerWithRef, setByPointerImmutable } = require('../dist/index.js');

test('ordinary data containing $ref is accessed literally on reads and writes', () => {
    const root = { decoy: { name: 'untouched' }, record: { $ref: '/decoy', name: 'original' } };
    assert.equal(getByPointer('/record/$ref', root), '/decoy');
    assert.equal(getByPointer('/record/name', root), 'original');
    assert.equal(setByPointer('updated', '/record/name', root), 'original');
    assert.equal(root.decoy.name, 'untouched');
    assert.equal(root.record.name, 'updated');
    assert.throws(() => getByPointer('/record/missing', root));
});

test('setter returns a detached deep snapshot of the old JSON value', () => {
    const root = { item: { child: [{ value: 1 }] } };
    const old = setByPointer({ child: [{ value: 2 }] }, '/item', root);
    assert.deepEqual(old, { child: [{ value: 1 }] });
    assert.notStrictEqual(old, root.item);
    old.child[0].value = 9;
    assert.equal(root.item.child[0].value, 2);
    assert.equal(setByPointer(0, '/new', root), undefined);
    assert.equal(root.new, 0);
});

test('setter validates previous and incoming values before mutating', () => {
    const old = {}; old.self = old;
    const input = {}; input.self = input;
    const root = { old, safe: 'before' };
    assert.throws(() => setByPointer('after', '/old', root), /JSON-compatible|cyclic/i);
    assert.strictEqual(root.old, old);
    assert.throws(() => setByPointer(input, '/safe', root), /JSON-compatible|cyclic/i);
    assert.equal(root.safe, 'before');
    assert.throws(() => setByPointer(undefined, '/safe', root), /JSON-compatible/i);
    assert.equal(root.safe, 'before');
});

test('mutable root writes reject and advanced setter returns a snapshot RefPoint', () => {
    const root = { item: { a: 1 } };
    assert.throws(() => setByPointer({ replaced: true }, '#', root), /root/i);
    assert.throws(() => setByPointerWithRef(1, '', root), /root/i);
    const ref = setByPointerWithRef({ a: 2 }, '/item', root);
    assert.deepEqual(ref.obj, { a: 1 });
    assert.notStrictEqual(ref.obj, root.item);
});

test('immutable setter copies only physical path and supports root replacement', () => {
    const root = { a: { items: ['one'] }, untouched: { keep: true } };
    const updated = setByPointerImmutable('two', ['/a/items/0', '1/-'], root);
    assert.deepEqual(updated.a.items, ['one', 'two']);
    assert.deepEqual(root.a.items, ['one']);
    assert.notStrictEqual(updated, root);
    assert.notStrictEqual(updated.a, root.a);
    assert.notStrictEqual(updated.a.items, root.a.items);
    assert.strictEqual(updated.untouched, root.untouched);
    assert.deepEqual(setByPointerImmutable({ fresh: true }, '#', root), { fresh: true });
    assert.throws(() => setByPointerImmutable('bad', ['/a/items/0', '0#'], root));
    assert.deepEqual(root.a.items, ['one']);
});

test('forged tree cannot substitute an edge with the same value', () => {
    const doc = { allowed: { value: 'same' }, outside: { value: 'same' } };
    const root = getReferenceByPointer('', doc);
    const forged = { obj: doc.outside, key: 'allowed', normalizedPath: '/allowed', parent: root };
    // Caller-supplied trees are untrusted even when another edge has the same value.
    assert.throws(() => setByPointerWithRef('changed', '0', doc, [root, forged]), /tree|invalid/i);
});