const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { getByPointer, setByPointer } = require('../dist/index.js');

// Run all prototype-pollution probes in fresh processes so even the unfixed
// published behavior cannot contaminate the test runner or its other tests.
function isolated(body) {
    const output = execFileSync(process.execPath, ['-e', `
        const { setByPointer, setByPointerWithRef } = require('./dist/index.js');
        ${body}
    `], { cwd: require('node:path').resolve(__dirname, '..'), encoding: 'utf8', timeout: 2000 });
    return JSON.parse(output.trim());
}

test('blocks inherited __proto__ traversal, including escaped and chained pointers', () => {
    const result = isolated(`
        const attempts = ['/__proto__/poison', '/%5F%5Fproto%5F%5F/poison', ['/safe', '1/__proto__/poison']];
        const refused = attempts.map(pointer => {
            try { setByPointer('x', pointer, { safe: {} }); return false; }
            catch (_) { return true; }
        });
        console.log(JSON.stringify({ refused, clean: ({}).poison === undefined }));
    `);
    assert.deepEqual(result, { refused: [true, true, true], clean: true });
});

test('blocks constructor and prototype traversal and dangerous final keys', () => {
    const result = isolated(`
        const attempts = ['/constructor/prototype/poison', '/prototype/poison', '/safe/__proto__'];
        const target = { safe: {} };
        const refused = attempts.map(pointer => {
            try { setByPointer('x', pointer, target); return false; }
            catch (_) { return true; }
        });
        console.log(JSON.stringify({ refused, clean: ({}).poison === undefined, ownSafe: Object.hasOwn(target.safe, '__proto__') === false }));
    `);
    assert.deepEqual(result, { refused: [true, true, true], clean: true, ownSafe: true });
});

test('does not traverse inherited members; raw references do not redirect writes', () => {
    const result = isolated(`
        const base = { shared: { original: true } };
        const doc = Object.create(base);
        doc.entry = { $ref: '/__proto__' };
        const attempts = [() => setByPointer(false, '/shared/original', doc), () => setByPointer('x', '/entry/poison', doc)];
        const refused = attempts.map(fn => { try { fn(); return false; } catch (_) { return true; } });
        console.log(JSON.stringify({ refused, unchanged: base.shared.original === true, clean: ({}).poison === undefined }));
    `);
    assert.deepEqual(result, { refused: [true, false], unchanged: true, clean: true });
});

test('legitimate existing raw reads and writes still work', () => {
    const doc = { items: ['one'], target: { label: 'old' }, link: { $ref: '/target' } };
    assert.equal(getByPointer('/items/0', doc), 'one');
    assert.equal(setByPointer('new', '/link/label', doc), undefined);
    assert.equal(doc.target.label, 'old');
    assert.equal(doc.link.label, 'new');
});

test('rejects a forged reference tree pointing outside the supplied document', () => {
    const result = isolated(`
        const doc = { ok: true };
        const outside = { key: 'original' };
        const root = { obj: doc, key: '#', normalizedPath: '', parent: null };
        const forged = { obj: outside.key, key: 'key', normalizedPath: '/key', parent: { obj: outside, key: 'elsewhere', normalizedPath: '/elsewhere', parent: root } };
        let refused;
        try { setByPointerWithRef('changed', '0', doc, [root, forged]); refused = false; }
        catch (_) { refused = true; }
        console.log(JSON.stringify({ refused, unchanged: outside.key === 'original' }));
    `);
    assert.deepEqual(result, { refused: true, unchanged: true });
});

test('never writes into a constructor prototype supplied as a root', () => {
    const result = isolated(`
        function Model() {}
        let refused;
        try { setByPointer(true, '/polluted', Model.prototype); refused = false; }
        catch (_) { refused = true; }
        console.log(JSON.stringify({ refused, clean: Model.prototype.polluted === undefined }));
    `);
    assert.deepEqual(result, { refused: true, clean: true });
});