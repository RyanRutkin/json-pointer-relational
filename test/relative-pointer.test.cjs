const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getByPointer, getReferenceByPointer, setByPointer, tokenizeJsonPointer } = require('../dist/index.js');

const doc = { foo: ['bar', 'baz'], highly: { nested: { objects: true } } };

test('examples from the 2020 relative JSON Pointer draft, from an array element', () => {
    for (const [pointer, expected] of [
        ['0', 'baz'], ['1/0', 'bar'], ['0-1', 'bar'], ['2/highly/nested/objects', true],
        ['0#', 1], ['0-1#', 0], ['1#', 'foo'], ['0+0', 'baz'],
    ]) {
        assert.equal(getByPointer(['/foo/1', pointer], doc), expected, pointer);
    }
});

test('relative keys from object members are strings; array keys are numbers', () => {
    assert.equal(getByPointer(['/highly/nested', '0#'], doc), 'nested');
    assert.equal(getByPointer(['/highly/nested', '1#'], doc), 'highly');
    const index = getReferenceByPointer(['/foo/1', '0#'], doc);
    assert.equal(typeof index.obj, 'number');
    assert.equal(index.obj, 1);
    assert.equal(index.parent.obj, 'baz');
});

test('relative descent and shifts keep the real physical parent and path', () => {
    const ref = getReferenceByPointer(['/foo/1', '0-1'], doc);
    assert.equal(ref.obj, 'bar');
    assert.equal(ref.parent.obj, doc.foo);
    assert.equal(ref.normalizedPath, '/foo/0');
    const target = { foo: [{ name: 'a' }, { name: 'b' }] };
    assert.equal(setByPointer('A', ['/foo/1', '0-1/name'], target), 'a');
    assert.equal(target.foo[0].name, 'A');
});

test('relative up and sibling shifts use the physical raw path', () => {
    const data = { foo: ['bar', 'baz'], link: { $ref: '#/foo/1' } };
    assert.equal(getByPointer(['/foo/1', '0-1'], data), 'bar');
    assert.equal(getByPointer(['/foo/1', '1#'], data), 'foo');
    assert.throws(() => getByPointer(['/link', '0-1'], data));
});

test('invalid relative grammar and failed evaluation do not silently navigate', () => {
    for (const pointer of ['01', '00#', '0-01', '0+01', '-1', '0-1+1', '0#x', '0+1#x', '0/invalid~2', '0//nope']) {
        assert.throws(() => getByPointer(['/foo/1', pointer], doc), undefined, pointer);
    }
    for (const pointer of ['3', '0-2', '0+1', '1-1', '1+0', '2#']) {
        assert.throws(() => getByPointer(['/foo/1', pointer], doc), undefined, pointer);
    }
    assert.throws(() => getByPointer('0#', doc));
    assert.throws(() => getByPointer(['/foo/1', '0#', '0'], doc));
});

test('computed relative keys are not writable', () => {
    const data = { foo: ['bar', 'baz'] };
    assert.throws(() => setByPointer('changed', ['/foo/1', '0#'], data));
    assert.deepEqual(data.foo, ['bar', 'baz']);
});

test('empty tokens, strict escapes, array indices, and literal percent in relative suffix', () => {
    const data = { foo: [{ '': { 'a/b': 'yes', '100%25': true } }] };
    assert.deepEqual(tokenizeJsonPointer('/foo/0//a~1b'), ['#', 'foo', '0', '', 'a/b']);
    assert.equal(getByPointer(['/foo/0', '0//a~1b'], data), 'yes');
    assert.equal(getByPointer(['/foo/0', '0//100%25'], data), true);
    for (const pointer of ['0/01', '0/0x', '0/-1', '0/-']) {
        assert.throws(() => getByPointer(['/foo', pointer], doc), undefined, pointer);
    }
});

test('relative and absolute missing reads fail while setting a missing final member is allowed', () => {
    const data = { group: { old: true } };
    assert.throws(() => getByPointer(['/group', '0/missing'], data));
    assert.throws(() => getByPointer('/group/missing', data));
    assert.equal(setByPointer('new', ['/group', '0/missing'], data), undefined);
    assert.equal(getByPointer('/group/missing', data), 'new');
});

test('root, empty member, and fragment syntax are distinct', () => {
    const data = { '': { 'a/b': 1 }, '100%25': 2, '100%': 3 };
    assert.equal(getByPointer('', data), data);
    assert.equal(getByPointer('#', data), data);
    assert.deepEqual(getByPointer('/', data), data['']);
    assert.deepEqual(getByPointer('#/', data), data['']);
    assert.equal(getByPointer('/100%25', data), 2);
    assert.equal(getByPointer('#/100%25', data), 3);
    assert.equal(getByPointer('#//a~1b', data), 1);
});

test('array append marker is write-only, even in a chained pointer', () => {
    const data = { foo: ['one'] };
    assert.throws(() => getByPointer('/foo/-', data));
    assert.throws(() => setByPointer('bad', ['/foo/-', '0'], data));
    assert.equal(setByPointer('two', '/foo/-', data), undefined);
    assert.deepEqual(data.foo, ['one', 'two']);
});