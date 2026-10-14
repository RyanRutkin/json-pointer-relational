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

test('ordinary missing member writes never invoke an inherited setter', () => {
    const result = isolated(`
        Object.defineProperty(Object.prototype, 'injected', {
            configurable: true,
            set(value) { Object.prototype.polluted = value; }
        });
        const target = {};
        try {
            const previous = setByPointer('yes', '/injected', target);
            console.log(JSON.stringify({ previousWasMissing: previous === undefined,
                own: Object.hasOwn(target, 'injected'), value: target.injected,
                clean: ({}).polluted === undefined }));
        } finally {
            delete Object.prototype.injected;
            delete Object.prototype.polluted;
        }
    `);
    assert.deepEqual(result, { previousWasMissing: true, own: true, value: 'yes', clean: true });
});

test('an own accessor at the final write destination is rejected before invoking it', () => {
    const result = isolated(`
        const target = {};
        let accessed = false;
        Object.defineProperty(target, 'item', { configurable: true, enumerable: true,
            get() { accessed = true; return 'old'; }, set(_) { accessed = true; }
        });
        let refused = false;
        try { setByPointer('new', '/item', target); } catch (_) { refused = true; }
        console.log(JSON.stringify({ refused, accessed, stillAccessor: !!Object.getOwnPropertyDescriptor(target, 'item').get }));
    `);
    assert.deepEqual(result, { refused: true, accessed: false, stillAccessor: true });
});

    test('array append cannot invoke an inherited numeric setter', () => {
        const result = isolated(`
            const target = { items: ['first'] };
            const customPrototype = Object.create(Array.prototype);
            Object.defineProperty(customPrototype, '1', {
                configurable: true,
                set(value) { Object.prototype.polluted = value; }
            });
            Object.setPrototypeOf(target.items, customPrototype);
            try {
                const old = setByPointer('second', '/items/-', target);
                console.log(JSON.stringify({ missing: old === undefined, own: Object.hasOwn(target.items, 1),
                    value: target.items[1], clean: ({}).polluted === undefined }));
            } finally {
                delete Object.prototype.polluted;
            }
        `);
        assert.deepEqual(result, { missing: true, own: true, value: 'second', clean: true });
    });

    test('an own accessor array element is rejected without invoking it', () => {
        const result = isolated(`
            const array = ['first'];
            let accessed = false;
            Object.defineProperty(array, '0', { configurable: true, enumerable: true,
                get() { accessed = true; return 'first'; }, set(_) { accessed = true; }
            });
            let refused = false;
            try { setByPointer('changed', '/items/0', { items: array }); } catch (_) { refused = true; }
            console.log(JSON.stringify({ refused, accessed, stillAccessor: !!Object.getOwnPropertyDescriptor(array, '0').get }));
        `);
        assert.deepEqual(result, { refused: true, accessed: false, stillAccessor: true });
    });