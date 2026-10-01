import {
    getReferenceByPointer,
    getByPointer, setByPointer,
    setByPointerImmutable,
    setByPointerWithRef,
    tokenizeJsonPointer,
    RefPoint as RefPointDef
} from './json-pointer-relational';
export {
    getReferenceByPointer,
    getByPointer,
    setByPointer,
    setByPointerImmutable,
    setByPointerWithRef,
    tokenizeJsonPointer
};
export type RefPoint = RefPointDef;
export { resolveSchemaByPointer } from './schema-resolver';
export type { SchemaResolution, SchemaResolveOptions, SchemaHop } from './schema-resolver';
export { setSchemaByPointer } from './schema-write';
export type { SchemaWriteOptions } from './schema-write';