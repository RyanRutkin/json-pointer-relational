import { RefPoint, tokenizeJsonPointer } from './json-pointer-relational';

/** Read-only schema navigation, not JSON Schema instance validation. No implicit I/O. */
export interface SchemaResolveOptions {
    /** Absolute retrieval URI for root; a root $id supersedes it as canonical identity. */
    baseURI: string;
    /** Only called for an unknown resource URI (without fragment). Must enforce its own trust/SSRF policy. */
    loadResource?: (uri: string) => Promise<unknown>;
    /** Outermost-to-innermost resource URIs already in the caller's evaluation scope. */
    dynamicScope?: readonly string[];
    /** Continue from a previously returned leaflet; relative pointers retain its physical parent chain. */
    from?: SchemaResolution;
    maxHops?: number;
    maxLoads?: number;
}

export interface SchemaHop {
    keyword: '$ref' | '$dynamicRef';
    fromURI: string;
    reference: string;
    staticURI: string;
    targetURI: string;
    /** JSON Pointer into the physical document containing the reference keyword. */
    fromDocumentPath: string;
    /** JSON Pointer into the physical document containing the target. */
    targetDocumentPath: string;
}

export interface SchemaResolution {
    value: unknown;
    /** Canonical URI of the containing schema resource. */
    resourceURI: string;
    /** JSON Pointer relative to resource root, not the containing document. */
    path: string;
    /** Physical JSON Pointer into documentRoot; may differ from path for embedded resources. */
    documentPath: string;
    documentURI: string;
    documentRoot: unknown;
    /** Physical parent chain, confined to the containing JSON document. Null for boolean roots. */
    point: RefPoint | null;
    hops: SchemaHop[];
    /** Resource evaluation scope, outermost first; supplied scope followed by traversed resources. */
    dynamicScope: string[];
}

type Resource = { uri: string; doc: DocumentIndex; rootPath: string; anchors: Map<string, Anchor> };
type Anchor = { path: string; dynamic: boolean };
type Location = { resource: Resource; path: string; schema: boolean };
type DocumentIndex = { root: unknown; retrievalURI: string; schemas: Map<string, Location> };
type Cursor = { doc: DocumentIndex; path: string; value: unknown; location: Location; point: RefPoint | null };

const own = (value: unknown, key: string): unknown => {
    if (!value || typeof value !== 'object') return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) return undefined;
    if (!('value' in descriptor)) throw new Error('Schema accessors are not supported');
    return descriptor.value;
};
const has = (value: unknown, key: string): boolean =>
    !!value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key);
const schemaValue = (value: unknown): boolean =>
    typeof value === 'boolean' || (!!value && typeof value === 'object' && !Array.isArray(value) &&
        value !== Object.prototype && value !== Array.prototype && value !== Function.prototype);
const escape = (token: string): string => token.replace(/~/g, '~0').replace(/\//g, '~1');
const uri = (ref: string, base: string): string => {
    if (ref.length > 16384) throw new Error('Schema URI length limit exceeded');
    if (/%(?![a-fA-F0-9]{2})/.test(ref)) throw new Error(`Invalid URI percent escape: ${ref}`);
    return new URL(ref, base).href;
};
const strip = (value: string): string => value.split('#')[0];
const pointerTokens = (pointer: string): string[] => tokenizeJsonPointer(pointer).slice(1);
const anchorName = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

// Only these known 2020-12 locations contain subschemas. Arbitrary annotation objects
// (even ones with an $id or $ref member) are data, not schema resources.
const single = new Set(['additionalProperties', 'unevaluatedProperties', 'propertyNames',
    'items', 'contains', 'unevaluatedItems', 'not', 'if', 'then', 'else', 'additionalItems']);
const maps = new Set(['$defs', 'definitions', 'properties', 'patternProperties', 'dependentSchemas']);
const arrays = new Set(['allOf', 'anyOf', 'oneOf', 'prefixItems']);

export async function resolveSchemaByPointer(
    pointer: string | string[], root: unknown, options: SchemaResolveOptions
): Promise<SchemaResolution> {
    if (!schemaValue(root)) throw new Error('Root must be an object or boolean schema');
    if (!options || typeof options.baseURI !== 'string') throw new Error('An absolute baseURI is required');
    const base = uri(options.baseURI, options.baseURI);
    if (!/^[A-Za-z][A-Za-z0-9+.-]*:/.test(base) || base.includes('#')) {
        throw new Error('baseURI must be an absolute URI without a fragment');
    }
    const maxHops = options.maxHops === undefined ? 64 : options.maxHops;
    const maxLoads = options.maxLoads === undefined ? 8 : options.maxLoads;
    if (![maxHops, maxLoads].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('Invalid resolution limits');
    const resources = new Map<string, Resource>();
    const documents = new Map<string, DocumentIndex>();
    const external = new Set<string>();
    let loads = 0;

    function indexDocument(value: unknown, retrievalURI: string): DocumentIndex {
        if (!schemaValue(value)) throw new Error('Loaded resource must be an object or boolean schema');
        const doc: DocumentIndex = { root: value, retrievalURI, schemas: new Map() };
        let nodes = 0;
        const stack: Array<{ value: unknown; path: string; resource?: Resource; resourcePath: string; depth: number }> =
            [{ value, path: '', resourcePath: '', depth: 0 }];
        while (stack.length) {
            const node = stack.pop()!;
            if (++nodes > 10000 || node.depth > 128) throw new Error('Schema index limit exceeded');
            if (!schemaValue(node.value)) throw new Error(`Expected schema at ${node.path}`);
            let resource = node.resource;
            let resourcePath = node.resourcePath;
            const id = own(node.value, '$id');
            if (id !== undefined && typeof id !== 'string') throw new Error('Invalid $id');
            if (!resource || id !== undefined) {
                const resolved = id === undefined ? retrievalURI : uri(id, resource ? resource.uri : retrievalURI);
                if (resolved.includes('#') && !resolved.endsWith('#')) throw new Error('$id must not contain a fragment');
                const canonical = strip(resolved);
                const existing = resources.get(canonical);
                if (existing && (existing.doc !== doc || existing.rootPath !== node.path)) {
                    throw new Error(`Duplicate schema resource URI: ${canonical}`);
                }
                resource = { uri: canonical, doc, rootPath: node.path, anchors: new Map() };
                resources.set(canonical, resource);
                resourcePath = '';
            }
            doc.schemas.set(node.path, { resource, path: resourcePath, schema: true });
            for (const [keyword, dynamic] of [['$anchor', false], ['$dynamicAnchor', true]] as const) {
                const name = own(node.value, keyword);
                if (name === undefined) continue;
                if (typeof name !== 'string' || !anchorName.test(name) || resource.anchors.has(name)) {
                    throw new Error(`Invalid or duplicate ${keyword}`);
                }
                resource.anchors.set(name, { path: node.path, dynamic });
            }
            if (!node.value || typeof node.value !== 'object') continue;
            for (const key of [...single, ...maps, ...arrays]) {
                if (!has(node.value, key)) continue;
                const child = own(node.value, key);
                const entries: Array<[string, unknown]> = [];
                if (single.has(key)) entries.push([key, child]);
                else if (arrays.has(key)) {
                    if (!Array.isArray(child)) throw new Error(`Expected schema array at ${key}`);
                    for (let i = 0; i < child.length; i++) entries.push([`${key}/${i}`, own(child, String(i))]);
                } else {
                    if (!child || typeof child !== 'object' || Array.isArray(child)) throw new Error(`Expected schema map at ${key}`);
                    for (const name of Object.keys(child)) entries.push([`${key}/${escape(name)}`, own(child, name)]);
                }
                for (const [suffix, entry] of entries) stack.push({
                    value: entry, path: `${node.path}/${suffix}`, resource,
                    resourcePath: `${resourcePath}/${suffix}`, depth: node.depth + 1
                });
            }
        }
        documents.set(retrievalURI, doc);
        // A retrieval URI can alias the document root even if it declares a different $id.
        if (resources.has(retrievalURI) && resources.get(retrievalURI)!.doc !== doc) {
            throw new Error(`Duplicate retrieval URI: ${retrievalURI}`);
        }
        return doc;
    }

    const rootDoc = indexDocument(root, base);
    function cursor(doc: DocumentIndex, path: string): Cursor {
        let value = doc.root;
        let point: RefPoint | null = value && typeof value === 'object'
            ? { obj: value, key: '#', normalizedPath: '', parent: null } : null;
        const tokens = path ? pointerTokens(path) : [];
        if (tokens.length > 256) throw new Error('Schema pointer depth limit exceeded');
        for (const token of tokens) {
            if (!point || !value || typeof value !== 'object' ||
                value === Object.prototype || value === Array.prototype || value === Function.prototype ||
                token === '__proto__' || token === 'constructor' || token === 'prototype') {
                throw new Error(`Unsafe or missing schema pointer member: ${token}`);
            }
            if (Array.isArray(value) && (!/^(0|[1-9][0-9]*)$/.test(token) ||
                !Number.isSafeInteger(Number(token)) || Number(token) >= value.length)) {
                throw new Error(`Invalid schema array index: ${token}`);
            }
            if (!has(value, token)) throw new Error(`Missing schema pointer member: ${token}`);
            value = own(value, token);
            point = { obj: value, key: token, normalizedPath: `${point.normalizedPath}/${escape(token)}`, parent: point };
        }
        const indexed = doc.schemas.get(path);
        let location = indexed;
        if (!location) {
            // Raw navigation into keyword values preserves their physical resource identity.
            let ancestor = path;
            while (!location) {
                ancestor = ancestor.slice(0, ancestor.lastIndexOf('/'));
                location = doc.schemas.get(ancestor);
                if (ancestor === '' && !location) throw new Error('Unindexed location');
            }
            location = { resource: location.resource, path: location.path + path.slice(ancestor.length), schema: false };
        }
        return { doc, path, value, location, point };
    }

    let current = cursor(rootDoc, '');
    let hops: SchemaHop[] = [];
    const scope: string[] = [];
    function enter(resourceURI: string): void {
        if (!scope.includes(resourceURI)) scope.push(resourceURI);
    }
    if (options.dynamicScope && (!Array.isArray(options.dynamicScope) || options.dynamicScope.length > 256)) {
        throw new Error('Invalid dynamic scope');
    }
    for (const entry of options.dynamicScope || []) {
        if (typeof entry !== 'string') throw new Error('Invalid dynamic scope entry');
        const normalized = uri(entry, base);
        if (normalized.includes('#')) throw new Error('dynamicScope entries must be resource URIs');
        enter(normalized);
    }
    if (options.from) {
        const from = options.from;
        if (!from.documentURI || typeof from.documentPath !== 'string') throw new Error('Invalid leaflet context');
        if (from.documentPath.endsWith('#')) throw new Error('Computed relative keys are not leaflet contexts');
        const fromDoc = from.documentRoot === root ? rootDoc : indexDocument(from.documentRoot, strip(uri(from.documentURI, base)));
        current = cursor(fromDoc, from.documentPath);
        if (current.value !== from.value || current.location.resource.uri !== from.resourceURI) throw new Error('Stale leaflet context');
        hops = from.hops.slice();
        if (!Array.isArray(from.dynamicScope) || from.dynamicScope.length > 256) throw new Error('Invalid leaflet scope');
        for (const entry of from.dynamicScope) {
            if (typeof entry !== 'string') throw new Error('Invalid leaflet scope entry');
            const normalized = uri(entry, base);
            if (normalized.includes('#')) throw new Error('Leaflet scope entries must be resource URIs');
            enter(normalized);
        }
    }
    enter(current.location.resource.uri);

    async function getResource(resourceURI: string): Promise<Resource> {
        const found = resources.get(resourceURI);
        if (found) return found;
        if (!options.loadResource) throw new Error(`No loader for schema resource ${resourceURI}`);
        if (loads >= maxLoads) throw new Error('Schema load limit exceeded');
        if (external.has(resourceURI)) throw new Error(`Unresolved schema resource ${resourceURI}`);
        loads++;
        external.add(resourceURI);
        const loaded = await options.loadResource(resourceURI);
        const doc = indexDocument(loaded, resourceURI);
        const resolved = resources.get(resourceURI);
        if (resolved) return resolved;
        // Retrieval URI is also an identifier for the fetched document root.
        const alias = doc.schemas.get('')!.resource;
        resources.set(resourceURI, alias);
        return alias;
    }

    async function at(target: string): Promise<Cursor> {
        const hash = target.indexOf('#');
        const resourceURI = hash === -1 ? target : target.slice(0, hash);
        const resource = await getResource(resourceURI);
        const fragment = hash === -1 ? '' : decodeURIComponent(target.slice(hash + 1));
        let path = resource.rootPath;
        if (fragment.startsWith('/')) {
            // Decode URI encoding exactly once, then interpret JSON Pointer escapes.
            const suffix = fragment.split('/').slice(1).map(token => {
                if (/~(?![01])/.test(token)) throw new Error('Invalid JSON Pointer escape');
                return token.replace(/~1/g, '/').replace(/~0/g, '~');
            });
            path += suffix.map(token => `/${escape(token)}`).join('');
        } else if (fragment) {
            const anchor = resource.anchors.get(fragment);
            if (!anchor) throw new Error(`Unknown schema anchor ${target}`);
            path = anchor.path;
        }
        const result = cursor(resource.doc, path);
        if (!result.location.schema) throw new Error(`Reference target is not a known schema: ${target}`);
        return result;
    }

    let count = 0;
    const visited = new Set<string>();
    async function follow(): Promise<void> {
        while (current.location.schema && current.value && typeof current.value === 'object') {
            // Both applicators can independently apply during validation. A single read
            // target cannot represent their combined result, so reject ambiguity.
            if (has(current.value, '$ref') && has(current.value, '$dynamicRef')) {
                throw new Error('Ambiguous schema navigation: both $ref and $dynamicRef');
            }
            const keyword = has(current.value, '$ref') ? '$ref' : has(current.value, '$dynamicRef') ? '$dynamicRef' : null;
            if (!keyword) break;
            const reference = own(current.value, keyword);
            if (typeof reference !== 'string') throw new Error(`Invalid ${keyword}`);
            const state = `${current.doc.retrievalURI}#${current.path}|${keyword}|${scope.join('|')}`;
            if (visited.has(state)) throw new Error('Reference cycle without pointer progress');
            visited.add(state);
            if (++count > maxHops) throw new Error('Schema reference hop limit exceeded');
            const source = current;
            const staticURI = uri(reference, source.location.resource.uri);
            let target = await at(staticURI);
            let targetURI = staticURI;
            if (keyword === '$dynamicRef') {
                const fragment = staticURI.indexOf('#');
                const name = fragment === -1 ? '' : decodeURIComponent(staticURI.slice(fragment + 1));
                const staticAnchor = target.location.resource.anchors.get(name);
                if (staticAnchor && staticAnchor.dynamic && staticAnchor.path === target.path) {
                    for (const resourceURI of scope) {
                        const candidate = await getResource(resourceURI);
                        if (candidate.anchors.get(name)?.dynamic) {
                            targetURI = `${candidate.uri}#${name}`;
                            target = await at(targetURI);
                            break;
                        }
                    }
                }
            }
            hops.push({ keyword, fromURI: source.location.resource.uri, reference, staticURI,
                targetURI, fromDocumentPath: source.path, targetDocumentPath: target.path });
            current = target;
            enter(current.location.resource.uri);
        }
    }

    const segments = typeof pointer === 'string' ? [pointer] : pointer;
    if (!Array.isArray(segments) || segments.some(p => typeof p !== 'string') || !segments.length) {
        throw new Error('Expected a pointer or a nonempty pointer chain');
    }
    if (segments.length > 256 || segments.some(p => p.length > 16384)) {
        throw new Error('Schema pointer limit exceeded');
    }
    for (let i = 0; i < segments.length; i++) {
        const part = segments[i];
        if (part === '' || part === '#' || part.startsWith('/') || part.startsWith('#/')) {
            // Absolute pointers are always rooted in the supplied document (not the last referenced resource).
            current = cursor(rootDoc, '');
            enter(current.location.resource.uri);
        }
        const tokens = pointerTokens(part);
        const prefix = tokenizeJsonPointer(part)[0];
        if (prefix !== '#') {
            const match = /^(0|[1-9][0-9]*)(?:([+-])(0|[1-9][0-9]*))?(#)?$/.exec(prefix);
            if (!match) throw new Error('Invalid relative pointer');
            const depth = Number(match[1]);
            if (!Number.isSafeInteger(depth)) throw new Error('Invalid relative depth');
            for (let n = 0; n < depth; n++) {
                if (!current.point?.parent) throw new Error('Relative pointer exceeded document root');
                current = cursor(current.doc, current.point.parent.normalizedPath);
            }
            if (match[2]) {
                const shift = Number(match[3]) * (match[2] === '-' ? -1 : 1);
                const parent = current.point?.parent;
                if (!Number.isSafeInteger(shift) || !parent || !Array.isArray(parent.obj)) throw new Error('Invalid relative index shift');
                const next = Number(current.point!.key) + shift;
                if (!Number.isSafeInteger(next)) throw new Error('Invalid relative index shift');
                current = cursor(current.doc, `${parent.normalizedPath}/${next}`);
            }
            if (match[4]) {
                if (tokens.length || i !== segments.length - 1 || !current.point?.parent) throw new Error('Invalid relative key');
                return { value: Array.isArray(current.point.parent.obj) ? Number(current.point.key) : current.point.key,
                    resourceURI: current.location.resource.uri, path: current.location.path + '#',
                    documentPath: current.path + '#', documentURI: current.doc.retrievalURI,
                    documentRoot: current.doc.root, point: current.point, hops, dynamicScope: scope };
            }
        }
        for (const token of tokens) {
            // A sibling keyword on a referencing schema is its own value, not a keyword of the target.
            if (!has(current.value, token) && !(Array.isArray(current.value) && /^(0|[1-9][0-9]*)$/.test(token))) {
                await follow();
            }
            current = cursor(current.doc, `${current.path}/${escape(token)}`);
            visited.clear(); // Consuming a concrete pointer token is progress, even across a recursive URI.
            enter(current.location.resource.uri);
        }
        // The selected schema is dereferenced before returning; a later relative segment
        // therefore starts at the resolved leaflet (including its physical parent).
        await follow();
    }
    return { value: current.value, resourceURI: current.location.resource.uri, path: current.location.path,
        documentPath: current.path, documentURI: current.doc.retrievalURI, documentRoot: current.doc.root,
        point: current.point, hops, dynamicScope: scope };
}