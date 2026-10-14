const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, rmSync, readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { createRequire } = require('node:module');

const root = join(__dirname, '..');

test('npm pack includes the public entry point and declarations, but no playground or tests', () => {
    const directory = mkdtempSync(join(tmpdir(), 'json-pointer-package-'));
    try {
        const name = execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--pack-destination', directory, '--silent'],
            { cwd: root, encoding: 'utf8' }).trim();
        const archive = join(directory, name);
        assert.ok(existsSync(archive));
        const content = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' });
        for (const file of ['package/dist/index.js', 'package/dist/index.d.ts',
            'package/dist/schema-resolver.js', 'package/dist/schema-write.d.ts']) {
            assert.ok(content.includes(file), `${file} missing from package`);
        }
        assert.doesNotMatch(content, /package\/(test|playground)\//);
        execFileSync('tar', ['-xzf', archive, '-C', directory]);
        const packagedJson = JSON.parse(execFileSync('tar', ['-xOzf', archive, 'package/package.json'], { encoding: 'utf8' }));
        assert.equal(packagedJson.main, 'dist/index.js');
        assert.equal(packagedJson.types, 'dist/index.d.ts');
        const packagedRoot = join(directory, 'package');
        const exports = Object.keys(createRequire(join(packagedRoot, 'package.json'))(packagedRoot));
        assert.ok(exports.includes('resolveSchemaByPointer'));
        assert.ok(exports.includes('setByPointerImmutable'));
        assert.match(readFileSync(join(packagedRoot, packagedJson.types), 'utf8'), /resolveSchemaByPointer/);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});
