const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getByPointer, getReferenceByPointer, setByPointer } = require('../dist/index.js');

test('1.x chained pointers can start at a leaflet and move to a sibling', () => {
    const root = { foo: ['bar', 'baz'], other: { label: true } };
    assert.equal(getByPointer(['/foo/1', '0-1'], root), 'bar');
    assert.equal(getByPointer(['/foo/1', '2/other/label'], root), true);
});

test('v2 raw navigation treats reference objects as ordinary data', () => {
    const root = { $defs: { target: { name: 'before' } }, link: { $ref: '#/$defs/target' } };
    assert.equal(getReferenceByPointer('/link/$ref', root).obj, '#/$defs/target');
    assert.equal(setByPointer('after', '/link/name', root), undefined);
    assert.equal(root.$defs.target.name, 'before');
    assert.equal(root.link.name, 'after');
    assert.equal(root.link.$ref, '#/$defs/target');
});

test('1.x setter still returns the old leaf rather than the root', () => {
    const root = { item: { count: 1 } };
    assert.equal(setByPointer({ count: 2 }, '/item', root).count, 1);
    assert.equal(root.item.count, 2);
});

test('a write at array length appends, updates data, and the same pointer becomes readable', () => {
    const root = { items: ['first', 'second', 'third'] };
    assert.throws(() => getByPointer('/items/3', root), /exceeds parent array length/);
    assert.equal(setByPointer('four', '/items/3', root), undefined);
    assert.deepEqual(root.items, ['first', 'second', 'third', 'four']);
    assert.equal(getByPointer('/items/3', root), 'four');
});

test('append through a chained pointer targets the physical array', () => {
    const root = { items: ['first'] };
    assert.equal(setByPointer('second', '/items/1', root), undefined);
    assert.equal(setByPointer('third', ['/items/1', '1/2'], root), undefined);
    assert.deepEqual(root.items, ['first', 'second', 'third']);
});

test('out-of-range array writes and reads do not create sparse items', () => {
    const root = { items: ['first'] };
    assert.throws(() => setByPointer('third', '/items/2', root), /exceeds parent array length/);
    assert.throws(() => getByPointer('/items/1', root), /exceeds parent array length/);
    assert.deepEqual(root.items, ['first']);
});