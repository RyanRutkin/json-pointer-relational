import {
    getByPointer, getReferenceByPointer, setByPointer, setByPointerWithRef,
    setByPointerImmutable, tokenizeJsonPointer, resolveSchemaByPointer, setSchemaByPointer
} from '../dist/index';
import type { RefPoint, SchemaResolveOptions, SchemaResolution, SchemaHop, SchemaWriteOptions } from '../dist/index';

const document = { items: ['one', 'two'] };
const point: RefPoint = getReferenceByPointer(['/items/1', '0-1'], document);
const tokens: string[] = tokenizeJsonPointer('/items/0');
const value: unknown = getByPointer('/items/0', document);
const previous: unknown = setByPointer('new', '/items/0', document);
const previousPoint: unknown = setByPointerWithRef('new', '/items/0', document);
const next: unknown = setByPointerImmutable('new', '/items/0', document);
const options: SchemaResolveOptions = { baseURI: 'https://example.test/schema.json' };
const writeOptions: SchemaWriteOptions = { ...options, mutableResources: new Map(), authorizeExternalWrite: async () => true };
const read: Promise<SchemaResolution> = resolveSchemaByPointer('/items', { items: true }, options);
const write: Promise<unknown> = setSchemaByPointer('new', '/items', { items: 'old' }, writeOptions);
const hop: SchemaHop = {
    keyword: '$ref', fromURI: options.baseURI, reference: '#', staticURI: options.baseURI,
    targetURI: options.baseURI, fromDocumentPath: '', targetDocumentPath: ''
};
void [point, tokens, value, previous, previousPoint, next, read, write, hop];
