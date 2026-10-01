import { useEffect, useRef } from 'react';
import { groups } from './doc-topics.js';

const Inline = ({ children }) => <code>{children}</code>;
const Code = ({ children }) => <pre className="docs-code"><code>{children.trim()}</code></pre>;
const Note = ({ children }) => <aside className="docs-note">{children}</aside>;
const Meta = ({ mode, result }) => <div className="docs-meta"><span>{mode}</span><span>{result}</span></div>;
const Params = ({ rows }) => <div className="docs-table-wrap"><table className="docs-table"><thead><tr><th>Parameter</th><th>Type</th><th>Purpose</th></tr></thead><tbody>{rows.map(([name, type, description]) => <tr key={name}><td><Inline>{name}</Inline></td><td><Inline>{type}</Inline></td><td>{description}</td></tr>)}</tbody></table></div>;

const content = {
  overview: {
    tag: 'THE LIBRARY', title: 'Overview',
    body: <>
      <h2>What is json-pointer-relational?</h2>
      <p>json-pointer-relational is a library for locating and updating values in JSON documents, starting at the document root or at a previously selected value (a leaflet). It implements the syntax and evaluation of the <a href="https://datatracker.ietf.org/doc/html/draft-bhutton-relative-json-pointer-00" target="_blank" rel="noreferrer">2020 Relative JSON Pointer draft ↗</a>: move up the document tree, shift to another array item with <Inline>+N</Inline> or <Inline>-N</Inline>, descend through a pointer suffix, or retrieve the current member name or array index with <Inline>#</Inline>. This version-specific link points to the archived 2020 draft, rather than a changing latest-draft URL.</p>
      <p>Beyond that draft, this library accepts chains of pointers so one result can become the starting leaflet for the next. Its explicit schema mode can follow references to leaflets in other JSON Schema resources; raw mode treats references as ordinary data. These are library capabilities, not additional requirements of the Relative JSON Pointer draft.</p>
      <p>Ready to try it in a project? See <a href="#/docs/installation">Installation</a> for the npm package and the current repository beta.</p>
      <p>Two ways to navigate: synchronous operations for ordinary JSON, and explicit asynchronous reference navigation for JSON Schema resources.</p>
      <h2>Choose the right mode</h2>
      <div className="docs-cards">
        <div className="docs-card"><span className="docs-card-icon">01 / RAW</span><h3>Synchronous JSON pointers</h3><p><Inline>getByPointer</Inline> and the setters address the members you name. A <Inline>$ref</Inline> property is ordinary data; no reference can silently redirect a read or write. There is no network access or Promise.</p><a href="#/docs/getByPointer">Explore raw methods ↗</a></div>
        <div className="docs-card"><span className="docs-card-icon">02 / SCHEMA</span><h3>Asynchronous schema traversal</h3><p><Inline>resolveSchemaByPointer</Inline> follows JSON Schema <Inline>$ref</Inline> / <Inline>$dynamicRef</Inline> across leaflets. It returns the physical location and reference hops. An optional caller-supplied loader can return external resources.</p><a href="#/docs/resolveSchemaByPointer">Explore schema methods ↗</a></div>
      </div>
      <h2>What this library does not do</h2>
      <p>It navigates documents and schema references; it does not validate an instance against a JSON Schema or combine the results of adjacent applicators. Schema writes are a separate, explicit operation. A linked pointer array is a library feature, not a Relative JSON Pointer syntax form.</p>
      <Note>The documentation describes the repository’s <strong>v2 beta source</strong>. The published 1.x release has different default reference behavior. See <a href="#/docs/migration">Migrating from 1.x</a>.</Note>
    </>,
  },
  pointers: {
    tag: 'GUIDE / SYNTAX', title: 'Pointer syntax', lead: 'Absolute pointers, URI fragments, and the linked 2020 Relative JSON Pointer draft share the same member-escaping rules but start in different places.',
    body: <>
      <h2>Absolute pointers</h2><p><Inline>''</Inline> and <Inline>'#'</Inline> select the supplied root. <Inline>'/'</Inline> and <Inline>'#/'</Inline> select its empty-name member. A slash starts each token; <Inline>~1</Inline> means <Inline>/</Inline> and <Inline>~0</Inline> means <Inline>~</Inline>. Empty tokens, including middle and trailing ones, are significant. A malformed tilde escape fails.</p>
      <Code>{`getByPointer('/a~1b', { 'a/b': 42 }); // 42
getByPointer('/', { '': 'empty key' }); // 'empty key'
getByPointer('#/name%20here', { 'name here': 1 }); // 1`}</Code>
      <p>Percent escapes are decoded in URI-fragment form only (leading <Inline>#</Inline>). Plain <Inline>/100%25</Inline> looks for a literal <Inline>100%25</Inline> key. Reading a missing object member throws.</p>
      <h2>2020-draft relative pointers</h2><p>A relative pointer begins with a non-negative integer (no leading zeros). It moves up that many levels from the <em>current leaflet</em>, may shift the current array index with <Inline>+N</Inline> or <Inline>-N</Inline>, then selects a value with an optional <Inline>/...</Inline> suffix or returns a key with terminal <Inline>#</Inline>. An array-item key is returned as a number; an object-member key is a string. Shifts must remain in bounds and apply to an array item, not the array itself.</p>
      <Code>{`const data = { items: ['one', 'two', 'three'] };
getByPointer(['/items/1', '0-1'], data); // 'one'
getByPointer(['/items/1', '0+1'], data); // 'three'
getByPointer(['/items/1', '0#'], data);  // 1 (number)
getByPointer(['/items/1', '1#'], data);  // 'items'`}</Code>
      <p>The initial absolute pointer in a <Inline>string[]</Inline> establishes the starting leaflet; subsequent strings run from the preceding result. An absolute segment restarts from the supplied root. This chaining is a library extension. Bare <Inline>#</Inline> selects the root; use <Inline>0#</Inline> for the current key. Relative pointers are <em>not</em> URI fragments and their percent signs remain literal.</p>
      <h2>Array members</h2><p>Array indices use <Inline>0</Inline> or digits without a leading zero. Reads require an existing member: <Inline>/items/-</Inline>, <Inline>/items/01</Inline>, and <Inline>/items/-1</Inline> fail. A final <em>write</em> at <Inline>-</Inline> or index equal to array length appends; writing beyond length does not create a sparse array. Appending is a setter extension, not RFC 6901 read behavior.</p>
    </>,
  },
  installation: {
    tag: 'GUIDE / GET STARTED', title: 'Installation', lead: 'Install the published package from npm, or build the repository version to try the v2 beta APIs described in these docs.',
    body: <>
      <h2>Published npm package</h2>
      <p>The library is hosted as <a href="https://www.npmjs.com/package/json-pointer-relational" target="_blank" rel="noreferrer">json-pointer-relational on npm ↗</a>. Add it to an existing JavaScript or TypeScript project:</p>
      <Code>{`npm install json-pointer-relational`}</Code>
      <p>The package includes its JavaScript entry point and TypeScript declarations. Import its named functions from <Inline>json-pointer-relational</Inline> after installing it.</p>
      <Note>The npm registry currently publishes <strong>1.0.10</strong>, while these docs describe the repository’s <strong>unpublished 2.0.0-beta.0 source</strong>. The published 1.x package follows <Inline>$ref</Inline> implicitly and does not include the v2 schema APIs or immutable setter. Check the <a href="https://www.npmjs.com/package/json-pointer-relational?activeTab=versions" target="_blank" rel="noreferrer">npm versions ↗</a> before using v2 examples.</Note>
      <h2>Try the repository’s v2 beta locally</h2>
      <p>To use these docs against the current source before a v2 npm release, clone the <a href="https://github.com/RyanRutkin/json-pointer-relational" target="_blank" rel="noreferrer">repository ↗</a>, install its dependencies, and build it. Then install the checkout as a local dependency in your application; replace the placeholder path with the location of your checkout.</p>
      <Code>{`# In the cloned json-pointer-relational repository
npm install
npm run build

# In your application directory
npm install /absolute/path/to/json-pointer-relational`}</Code>
      <p>After a v2 release appears on npm, install that published version normally instead of using a local checkout. To explore the source without installing it into another project, use the <a href="#/playground">Playground</a>.</p>
    </>,
  },
  quickstart: {
    tag: 'GUIDE / GET STARTED', title: 'Quick start', lead: 'Import from the package entry point and choose raw navigation or schema-aware navigation deliberately.',
    body: <>
      <h2>Raw reads and writes · synchronous</h2><Code>{`import { getByPointer, setByPointer, setByPointerImmutable } from 'json-pointer-relational';

const root = { items: ['first'], meta: { untouched: true } };
getByPointer('/items/0', root); // 'first'
const old = setByPointer('second', '/items/1', root); // undefined; root.items grows
const next = setByPointerImmutable('third', '/items/2', root);
// next.items has three elements; root.items still has two
// next.meta === root.meta (structural sharing)`}</Code>
      <h2>Follow a schema reference · asynchronous</h2><Code>{`import { resolveSchemaByPointer } from 'json-pointer-relational';

const schema = {
  $id: 'https://example.test/schema',
  $defs: { name: { type: 'string' } },
  properties: { displayName: { $ref: '#/$defs/name' } }
};
const result = await resolveSchemaByPointer(
  '/properties/displayName/type', schema,
  { baseURI: 'https://example.test/schema' }
);
console.log(result.value);        // 'string'
console.log(result.documentPath); // '/$defs/name/type'`}</Code>
      <Note>Only the explicit schema methods follow references. The playground’s Schema refs mode intentionally has no external loader; in your application, provide <Inline>loadResource</Inline> only after defining a trust policy.</Note>
    </>,
  },
  tokenizeJsonPointer: {
    tag: 'SYNC / UTILITY', title: 'tokenizeJsonPointer', lead: 'Parse a single absolute or relative pointer into its decoded navigation tokens.',
    body: <><Meta mode="Synchronous" result="Returns string[]"/><Code>{`tokenizeJsonPointer(pointer: string): string[]`}</Code><Params rows={[["pointer", "string", "An absolute pointer, URI-fragment pointer, or 2020-draft relative pointer."]]}/>
      <h2>Result</h2><p>Absolute pointers start with an internal <Inline>'#'</Inline> root marker, followed by decoded member names. A relative pointer starts with its distance/shift/key prefix (for example <Inline>'0-1'</Inline>), followed by unescaped suffix tokens. The marker is an internal tokenizer convention—not a JSON object key.</p>
      <Code>{`tokenizeJsonPointer('/a//b');       // ['#', 'a', '', 'b']
tokenizeJsonPointer('#/a%20b');   // ['#', 'a b']
tokenizeJsonPointer('0-1/a~1b'); // ['0-1', 'a/b']
tokenizeJsonPointer('/');         // ['#', '']`}</Code>
      <p>Fragment percent-decoding happens before JSON Pointer token unescaping. Plain and relative pointers do not percent-decode. Rejects invalid relative grammar, malformed URI percent-encoding and invalid <Inline>~</Inline> escapes. Tokenizing does <em>not</em> inspect a document or ensure any token resolves.</p></>,
  },
  getByPointer: {
    tag: 'SYNC / RAW READ', title: 'getByPointer', lead: 'Read a value from a JSON document without interpreting $ref properties.',
    body: <><Meta mode="Synchronous · no Promise" result="Returns value (any)"/><Code>{`getByPointer(pointer: string | string[], obj: Record<string, any>): any`}</Code><Params rows={[["pointer", "string | string[]", "A single pointer or a chain. An absolute segment restarts at the supplied root; a relative segment continues from the preceding leaflet."],["obj", "Record<string, any>", "The JSON-compatible root object or array to navigate."]]}/>
      <h2>Result and errors</h2><p>Returns the actual value, including an object reference if the selected member is an object; it does not copy it. It does not follow <Inline>$ref</Inline>. Reads fail on missing members, invalid paths, nonexistent array positions, <Inline>-</Inline>, or unsafe prototype-bearing tokens. A relative terminal <Inline>0#</Inline> returns the current member name (string) or array index (number).</p>
      <Code>{`getByPointer('/record/$ref', { record: { $ref: '/elsewhere' } }); // '/elsewhere'
getByPointer(['/items/1', '0-1'], { items: ['a', 'b'] }); // 'a'`}</Code><Note>For reference-aware JSON Schema reads, use <a href="#/docs/resolveSchemaByPointer">resolveSchemaByPointer</a> instead.</Note></>,
  },
  getReferenceByPointer: {
    tag: 'SYNC / RAW LOCATION', title: 'getReferenceByPointer', lead: 'Resolve a raw-data location and return its value plus a physical parent chain.',
    body: <><Meta mode="Synchronous · no Promise" result="Returns RefPoint"/><Code>{`getReferenceByPointer(
  pointer: string | string[], obj: Record<string, any>, tree?: RefPoint[]
): RefPoint`}</Code><Params rows={[["pointer", "string | string[]", "Single pointer or chain, with the same raw navigation rules as getByPointer."],["obj", "Record<string, any>", "Document root."],["tree", "RefPoint[] (optional)", "Advanced starting path inside obj. The supplied tree is checked before navigation; ordinary callers should omit it."]]}/>
      <h2>Result</h2><p>Returns a <a href="#/docs/RefPoint">RefPoint</a> with <Inline>obj</Inline> (the selected value), <Inline>key</Inline>, <Inline>normalizedPath</Inline>, and <Inline>parent</Inline>. The parent chain represents the physical path. Terminal relative keys such as <Inline>0#</Inline> are marked <Inline>computed</Inline> and are not writable. It throws on missing or unsafe members, invalid syntax, and invalid supplied trees.</p>
      <Code>{`const root = { items: ['a', 'b'] };
const ref = getReferenceByPointer(['/items/1', '0-1'], root);
ref.obj;            // 'a'
ref.normalizedPath; // '/items/0'
ref.parent.obj;     // root.items`}</Code><p>Unlike <a href="#/docs/resolveSchemaByPointer">schema resolution</a>, this method never follows <Inline>$ref</Inline> and does not return resource metadata or reference hops.</p></>,
  },
  setByPointer: {
    tag: 'SYNC / MUTABLE WRITE', title: 'setByPointer', lead: 'Write at a raw JSON location in place, and get an independent snapshot of what was there before.',
    body: <><Meta mode="Synchronous · mutates input" result="Returns previous JSON value or undefined"/><Code>{`setByPointer(value: any, pointer: string | string[], obj: Record<string, any>): any`}</Code><Params rows={[["value", "any", "JSON-compatible replacement value; validated before mutation."],["pointer", "string | string[]", "Target pointer or chain; only the final position may be newly added."],["obj", "Record<string, any>", "Document to mutate in place."]]}/>
      <h2>Result and mutation</h2><p>Returns a detached deep copy of the value at the final location <em>before</em> assignment, or <Inline>undefined</Inline> if the final member was absent. It does not return the updated root. The previous value and incoming value must be acyclic JSON-compatible values; cycles, unsupported values, getters encountered during cloning and sparse arrays throw before assignment. Deep-copy cost grows with the previous leaflet’s size.</p>
      <Code>{`const root = { item: { score: 1 }, items: ['a'] };
const previous = setByPointer({ score: 2 }, '/item', root);
// previous is { score: 1 }, detached from root.item
setByPointer('b', '/items/-', root); // append, previous value: undefined
// root.items is now ['a', 'b']`}</Code><p>Only the final member can be created: a missing parent fails. For arrays, final <Inline>-</Inline> or <Inline>index === length</Inline> appends; a larger index fails. Root replacement and computed relative-key writes throw. The operation is raw—<Inline>$ref</Inline> never redirects it.</p></>,
  },
  setByPointerWithRef: {
    tag: 'SYNC / ADVANCED WRITE', title: 'setByPointerWithRef', lead: 'Perform an in-place raw write and receive location metadata along with its detached previous value.',
    body: <><Meta mode="Synchronous · mutates input" result="Returns RefPoint-shaped value (declared any)"/><Code>{`setByPointerWithRef(
  value: any, pointer: string | string[], obj: Record<string, any>, tree?: RefPoint[]
): any`}</Code><Params rows={[["value", "any", "JSON-compatible replacement value."],["pointer", "string | string[]", "Pointer or chain to the final raw target."],["obj", "Record<string, any>", "Document root to mutate."],["tree", "RefPoint[] (optional)", "Advanced supplied starting chain; checked against the document."]]}/>
      <h2>Result</h2><p>Returns a <Inline>RefPoint</Inline>-shaped result. Crucially, its <Inline>obj</Inline> is the detached <em>previous</em> value, not the new value. The <Inline>parent</Inline> still identifies the actual mutable destination, and <Inline>normalizedPath</Inline> records the selected path. Its TypeScript return signature is currently <Inline>any</Inline>, so inspect this contract rather than assuming the return represents a post-write reference. For only the old value use <a href="#/docs/setByPointer">setByPointer</a>.</p>
      <Code>{`const root = { status: 'old' };
const ref = setByPointerWithRef('new', '/status', root);
ref.obj;          // 'old'
ref.parent.obj;   // root, now { status: 'new' }`}</Code><p>Validation, append behavior, root/computed-key restrictions, security checks, and raw <Inline>$ref</Inline> treatment are identical to <Inline>setByPointer</Inline>. A supplied tree is intended for advanced use, not arbitrary pointers into another document.</p></>,
  },
  setByPointerImmutable: {
    tag: 'SYNC / IMMUTABLE WRITE', title: 'setByPointerImmutable', lead: 'Produce a new root with path-copy structural sharing; the supplied document is not mutated.',
    body: <><Meta mode="Synchronous · no input mutation" result="Returns new root (any)"/><Code>{`setByPointerImmutable(
  value: any, pointers: string | string[], obj: Record<string, any>
): any`}</Code><Params rows={[["value", "any", "JSON-compatible replacement; validated before resolving the path."],["pointers", "string | string[]", "Single raw target or a chain ending at the target."],["obj", "Record<string, any>", "Root to leave unchanged."]]}/>
      <h2>Result and sharing</h2><p>Copies the root and each object/array on the resolved path, then returns the new root. Subtrees away from the path keep their original references; this is not a full-document deep clone. It is useful for state containers that rely on reference equality. A root pointer such as <Inline>''</Inline> or <Inline>'#'</Inline> returns the replacement value directly.</p>
      <Code>{`const root = { items: ['a'], metadata: { stable: true } };
const next = setByPointerImmutable('b', '/items/-', root);
// next.items is ['a', 'b']; root.items is ['a']
// next !== root; next.items !== root.items
// next.metadata === root.metadata`}</Code><p>Accepts missing <em>final</em> object keys and final array append positions, but does not auto-create missing intermediate containers. Invalid pointers and computed key targets fail. It does not follow <Inline>$ref</Inline>. For a mutation plus old-value snapshot use <a href="#/docs/setByPointer">setByPointer</a> instead.</p></>,
  },
  resolveSchemaByPointer: {
    tag: 'ASYNC / SCHEMA READ', title: 'resolveSchemaByPointer', lead: 'Navigate JSON Schema 2020-12 reference targets explicitly and return both the resolved value and where it physically lives.',
    body: <><Meta mode="Asynchronous · Promise" result="Promise<SchemaResolution>"/><Code>{`resolveSchemaByPointer(
  pointer: string | string[], root: unknown, options: SchemaResolveOptions
): Promise<SchemaResolution>`}</Code><Params rows={[["pointer", "string | string[]", "Pointer or chain; relative segments can continue from a resolved leaflet, while absolute ones restart at the supplied root."],["root", "unknown", "Root JSON Schema object or boolean."],["options", "SchemaResolveOptions", "Requires an absolute, fragment-free baseURI; optional loader, scope, leaflet context and limits."]]}/>
      <h2>How schema traversal works</h2><p>Indexes recognized subschema positions, including <Inline>$defs</Inline>, <Inline>properties</Inline> and applicator positions. Tracks resource-specific <Inline>$id</Inline> bases, embedded/external resources, pointer fragments, <Inline>$anchor</Inline> and <Inline>$dynamicAnchor</Inline>. Traversal follows <Inline>$ref</Inline> and <Inline>$dynamicRef</Inline> when navigating through referenced leaflets. A <Inline>$dynamicRef</Inline> resolves statically first; if the target is a dynamic anchor, the ordered outermost matching dynamic scope can override it.</p>
      <p>Adjacent keywords on the referencing object remain addressable as local data: navigating to its <Inline>title</Inline> or literal <Inline>$ref</Inline> does not force a hop. Selecting the referencing schema itself follows the reference. Resolution returns <a href="#/docs/SchemaResolution">SchemaResolution</a> with resource identity, physical path and a <a href="#/docs/SchemaHop">SchemaHop</a> record for each reference hop.</p>
      <Code>{`const schema = {
  $id: 'https://example.test/root',
  $defs: { label: { type: 'string' } },
  properties: { name: { $ref: '#/$defs/label' } }
};
const result = await resolveSchemaByPointer('/properties/name/type', schema, {
  baseURI: 'https://example.test/root'
});
// result.value === 'string'
// result.documentPath === '/$defs/label/type'
// result.hops.length === 1`}</Code>
      <h2>Loading and limits</h2><p>No external resource is fetched automatically. For unknown URI resources, supply your own <Inline>loadResource(uri)</Inline> callback in <Inline>options</Inline> (the <a href="#/docs/SchemaResolveOptions">SchemaResolveOptions</a> argument). It receives a fragment-free URI and returns a Promise of a schema; the library does not provide the callback. The caller must enforce trust, allowlisting, response size and SSRF policy. Defaults: at most 64 reference hops and 8 external loads per resolution; schema indexing, URI length, pointer length/depth and chain size are also bounded.</p>
      <Note>This API is <strong>navigation, not validation</strong>. It does not apply schema assertions to instance data or combine multiple adjacent applicators into a validation result. A schema containing both <Inline>$ref</Inline> and <Inline>$dynamicRef</Inline> at one location is rejected as ambiguous for navigation. Unsupported URIs under the platform URL implementation, missing resources, malformed pointers, invalid anchors, duplicate resource IDs, or non-progressing reference cycles reject the Promise.</Note></>,
  },
  setSchemaByPointer: {
    tag: 'ASYNC / SCHEMA WRITE', title: 'setSchemaByPointer', lead: 'Opt into a reference-aware in-place write at an existing, resolved schema target.',
    body: <><Meta mode="Asynchronous · Promise · mutates target" result="Promise<unknown> (previous snapshot)"/><Code>{`setSchemaByPointer(
  value: unknown, pointer: string | string[],
  root: unknown, options: SchemaWriteOptions
): Promise<unknown>`}</Code><Params rows={[["value", "unknown", "JSON-compatible value to write; validated by the final raw setter."],["pointer", "string | string[]", "Pointer or chain naming an existing target; schema references may lead to another physical location."],["root", "unknown", "Root schema document supplied to the resolver."],["options", "SchemaWriteOptions", "Resolver options plus optional external mutable resource registry and authorization callback."]]}/>
      <h2>Result and destination</h2><p>Returns a Promise of the detached <em>old</em> target value, rather than the updated root. This setter resolves the physical <Inline>documentPath</Inline>, not just the logical path. Root and computed-key writes are rejected. It currently writes only to an existing resolved target; it does not create missing schema members or remote resources.</p>
      <Code>{`const schema = {
  $id: 'https://example.test/root',
  $defs: { label: { type: 'string' } },
  properties: { name: { $ref: '#/$defs/label' } }
};
const old = await setSchemaByPointer('number',
  '/properties/name/type', schema,
  { baseURI: 'https://example.test/root' });
// old === 'string'; schema.$defs.label.type === 'number'`}</Code>
      <h2>External write authorization</h2><p>Same-document target writes do not need external approval. If a reference lands in a loaded external document, the caller must supply <strong>both</strong> <Inline>mutableResources</Inline>, mapping its <Inline>documentURI</Inline> to the <em>exact loaded object</em>, and <Inline>authorizeExternalWrite(target)</Inline> returning true (or a Promise of true). The callback can inspect the physical path before approving. The implementation rechecks the destination after asynchronous authorization to avoid writing into a changed parent or leaf.</p>
      <Note>This method is deliberately opt-in. To edit a schema document’s literal <Inline>$ref</Inline> property, use the synchronous raw <a href="#/docs/setByPointer">setByPointer</a> instead.</Note></>,
  },
  RefPoint: {
    tag: 'TYPE / RAW LOCATION', title: 'RefPoint', lead: 'The raw navigator’s physical location and linked parent context.',
    body: <><Meta mode="TypeScript type · erased at runtime" result="Used by raw reads and advanced writes"/><Code>{`type RefPoint = {
  obj: any;
  key: string;
  normalizedPath: string;
  parent: RefPoint | null;
  computed?: boolean;
};`}</Code><p><Inline>obj</Inline> holds the selected value; <Inline>key</Inline> is its member name or string array index; <Inline>normalizedPath</Inline> is the physical JSON Pointer route; and <Inline>parent</Inline> links to the containing location (null at the root). <Inline>computed</Inline> marks a terminal relative key result such as <Inline>0#</Inline>, which is not writable. For those results, <Inline>obj</Inline> is a string object key or a numeric array index.</p><Note>A <Inline>setByPointerWithRef</Inline> return is RefPoint-shaped but intentionally stores the detached <em>previous</em> value in <Inline>obj</Inline>. Do not use that field as a reference to the newly written value.</Note></>,
  },
  SchemaResolveOptions: {
    tag: 'TYPE / SCHEMA READ OPTIONS', title: 'SchemaResolveOptions', lead: 'Configuration and explicit evaluation context for async schema navigation.',
    body: <><Meta mode="TypeScript interface · erased at runtime" result="Required by resolveSchemaByPointer"/><Code>{`interface SchemaResolveOptions {
  baseURI: string;
  loadResource?: (uri: string) => Promise<unknown>;
  dynamicScope?: readonly string[];
  from?: SchemaResolution;
  maxHops?: number;
  maxLoads?: number;
}`}</Code><Params rows={[["baseURI", "string", "Required absolute retrieval URI with no fragment. A root $id may establish a different canonical resource URI."],["loadResource", "(uri: string) => Promise<unknown>", "Optional callback for unknown fragment-free resource URIs. No automatic network I/O; caller enforces trust and resource size."],["dynamicScope", "readonly string[]", "Optional resource URI list from outermost to innermost for $dynamicRef lookup; caller maintains evaluation context."],["from", "SchemaResolution", "Optional prior resolution to continue from a non-computed leaflet. Stale value/resource context is rejected."],["maxHops", "number", "Maximum reference hops; default 64, nonnegative safe integer."],["maxLoads", "number", "Maximum external loads; default 8, nonnegative safe integer."]]}/><p>An absolute pointer restarts at the supplied root even when <Inline>from</Inline> names an external resource. A relative pointer keeps the current physical document and parent chain. The loader never runs unless a reference requires an unknown resource.</p></>,
  },
  SchemaResolution: {
    tag: 'TYPE / SCHEMA RESULT', title: 'SchemaResolution', lead: 'Value, canonical resource position, physical document position, and traversal history from async schema navigation.',
    body: <><Meta mode="TypeScript interface · returned in Promise" result="resolveSchemaByPointer result"/><Code>{`interface SchemaResolution {
  value: unknown;
  resourceURI: string;
  path: string;
  documentPath: string;
  documentURI: string;
  documentRoot: unknown;
  point: RefPoint | null;
  hops: SchemaHop[];
  dynamicScope: string[];
}`}</Code><p><Inline>value</Inline> is the selected schema value or keyword data. <Inline>resourceURI</Inline> identifies the containing schema resource; <Inline>path</Inline> is a JSON Pointer relative to that resource root. <Inline>documentURI</Inline> and <Inline>documentRoot</Inline> identify the physical document holding the value, while <Inline>documentPath</Inline> addresses it in that document. An embedded <Inline>$id</Inline> may make <Inline>path</Inline> differ from <Inline>documentPath</Inline>.</p><p><Inline>point</Inline> contains the physical RefPoint parent chain (or null for a boolean root). <Inline>hops</Inline> records the reference traversals; <Inline>dynamicScope</Inline> is the ordered resource context. Use the full result as the <Inline>from</Inline> option to continue from a leaflet. A terminal computed-key result is not a location you can continue from or write into.</p></>,
  },
  SchemaHop: {
    tag: 'TYPE / REFERENCE TRACE', title: 'SchemaHop', lead: 'One explicit reference crossing recorded by schema navigation.',
    body: <><Meta mode="TypeScript interface · erased at runtime" result="Entries in SchemaResolution.hops"/><Code>{`interface SchemaHop {
  keyword: '$ref' | '$dynamicRef';
  fromURI: string;
  reference: string;
  staticURI: string;
  targetURI: string;
  fromDocumentPath: string;
  targetDocumentPath: string;
}`}</Code><p><Inline>keyword</Inline> identifies the schema reference keyword, and <Inline>reference</Inline> preserves its original URI-reference text. <Inline>fromURI</Inline> identifies the referring resource. <Inline>staticURI</Inline> records ordinary URI resolution against its base; <Inline>targetURI</Inline> is the actual destination, which can differ when a matching dynamic anchor overrides the static target. The document paths identify the physical referencing and referenced positions. Use these fields to explain where a logical pointer crossed from one schema leaflet to another.</p></>,
  },
  SchemaWriteOptions: {
    tag: 'TYPE / SCHEMA WRITE OPTIONS', title: 'SchemaWriteOptions', lead: 'Schema resolution options plus explicit authorization for writes into external documents.',
    body: <><Meta mode="TypeScript interface · erased at runtime" result="Required by setSchemaByPointer"/><Code>{`interface SchemaWriteOptions extends SchemaResolveOptions {
  mutableResources?: ReadonlyMap<string, unknown>;
  authorizeExternalWrite?: (
    target: SchemaResolution
  ) => boolean | Promise<boolean>;
}`}</Code><p>All <a href="#/docs/SchemaResolveOptions">SchemaResolveOptions</a> apply, including required <Inline>baseURI</Inline> and optional loader. <Inline>mutableResources</Inline> registers the exact externally loaded objects that may be edited, by physical <Inline>documentURI</Inline>. <Inline>authorizeExternalWrite</Inline> receives the resolved target and must approve an external write explicitly; returning false or rejecting prevents mutation. Neither field is required for writes inside the original supplied document.</p><Note>Loaded resources are read-only unless both the registry entry and authorization callback approve the write. Authorization alone does not grant write access to every schema the loader can read.</Note></>,
  },
  security: {
    tag: 'GUIDE / SAFETY', title: 'Security & limits', lead: 'Treat pointers and externally supplied schemas as untrusted input, and keep reference-aware writes behind explicit policy.',
    body: <><h2>Raw access</h2><p>Raw traversal does not follow <Inline>$ref</Inline> and rejects prototype-bearing tokens (<Inline>__proto__</Inline>, <Inline>constructor</Inline>, <Inline>prototype</Inline>) and inherited members. This prevents prototype-polluting write paths, but restricts some otherwise valid JSON property names. Computed relative keys cannot be set. Applications should also bound untrusted pointer length and nesting.</p><h2>Schema resolution</h2><p>No network request is implicit. An application-provided <Inline>loadResource</Inline> must enforce protocol/host allowlists, authentication, response size, timeouts and SSRF protections. Navigation caps reference hops (64 by default) and loads (8 by default), plus schema indexing and pointer length/depth. Cycles without pointer progress are rejected. These limits are not a substitute for application input limits.</p><h2>Mutation boundaries</h2><p>Editing a schema <em>as data</em> should use the raw setters so a user-supplied <Inline>$ref</Inline> cannot redirect a write. <Inline>setSchemaByPointer</Inline> follows references intentionally; external physical documents require matching mutable registration and authorization. Mutable setters snapshot and validate their JSON-compatible values before assignment; immutable updates reuse unrelated subtrees.</p><Note>Schema reference navigation does not validate JSON instances or interpret multiple applicator results. Use an actual JSON Schema validator if you need assertion outcomes.</Note></>,
  },
  migration: {
    tag: 'GUIDE / UPGRADE', title: 'Migrating from 1.x', lead: 'The v2 beta deliberately separates raw JSON access from reference-following schema navigation.',
    body: <><h2>1. Reference following is explicit</h2><p>In 1.x, synchronous navigation could follow any <Inline>$ref</Inline> property—even in ordinary JSON—and redirect writes. In v2, the same synchronous names are raw by default. Replace intentional reference reads with <Inline>await resolveSchemaByPointer(..., {`{ baseURI }`})</Inline> and intentional reference writes with <Inline>await setSchemaByPointer(...)</Inline>. Edit literal schema keywords using raw methods.</p><h2>2. Previous value is detached</h2><p><Inline>setByPointer</Inline> still returns the old leaflet, but now as a deep JSON snapshot. It does not return the updated root. Invalid/cyclic values throw before mutation; mutable root writes now throw. To replace the root or retain the old root unchanged, use <Inline>setByPointerImmutable</Inline>.</p><h2>3. Strict pointer syntax remains</h2><p>The repository’s 2020-draft relative-pointer alignment is retained: shifts like <Inline>0-1</Inline>, numeric array <Inline>0#</Inline>, strict non-negative distances without leading zeros, and meaningful empty member names. A chained pointer array remains a library extension. Bare <Inline>#</Inline> means document root, not current member key; use <Inline>0#</Inline>. Reads of missing positions or <Inline>/array/-</Inline> fail; final writes may append.</p><Code>{`// Old behavior: getByPointer('/properties/name/type', schema)
// New behavior: explicit, async reference navigation
const { value, documentPath } = await resolveSchemaByPointer(
  '/properties/name/type', schema, { baseURI: 'https://example.test/schema' }
);`}</Code><p>This documentation covers the repository’s unreleased v2 beta. Check the installed version before relying on these exports.</p></>,
  },
};

export function Docs({ topicId }) {
  const selected = content[topicId] || content.overview;
  const articleRef = useRef(null);
  useEffect(() => {
    articleRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [topicId]);

  return (
    <main className="docs-layout" id="docs-content" tabIndex={-1}>
      <aside className="docs-sidebar" aria-label="Documentation topics">
        <div className="docs-sidebar-heading">DOCUMENTATION <span>v2 beta</span></div>
        <label className="docs-mobile-topic" htmlFor="docs-topic-select">Topic
          <select id="docs-topic-select" value={topicId} onChange={event => { window.location.hash = `#/docs/${event.target.value}`; }}>
            {groups.map(group => <optgroup label={group.title} key={group.title}>
              {group.items.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
            </optgroup>)}
          </select>
        </label>
        <nav aria-label="Topics">
          {groups.map(group => <div className="docs-nav-group" key={group.title}>
            <div className="docs-nav-label">{group.title}</div>
            {group.items.map(([id, title]) =>
              <a key={id} href={`#/docs/${id}`} aria-current={topicId === id ? 'page' : undefined}>{title}</a>
            )}
          </div>)}
        </nav>
      </aside>
      <article className="docs-article" ref={articleRef} key={topicId} aria-labelledby="docs-title">
        <div className="eyebrow"><span className="live-dot" /> {selected.tag}</div>
        <h1 id="docs-title">{selected.title}<span className="docs-heading-period">.</span></h1>
        {selected.lead && <p className="docs-lead">{selected.lead}</p>}
        <div className="docs-rule" />
        <div className="docs-body">{selected.body}</div>
        <div className="docs-bottom"><a href="#/playground">← Back to playground</a><a href="https://github.com/RyanRutkin/json-pointer-relational" target="_blank" rel="noreferrer">View source ↗</a></div>
      </article>
    </main>
  );
}
