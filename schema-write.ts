import { getReferenceByPointer, setByPointer } from './json-pointer-relational';
import { resolveSchemaByPointer, SchemaResolution, SchemaResolveOptions } from './schema-resolver';

/** Schema-aware mutations are explicit; they never run through the raw setter by default. */
export interface SchemaWriteOptions extends SchemaResolveOptions {
    /** External documents must be registered with the exact object returned by loadResource. */
    mutableResources?: ReadonlyMap<string, unknown>;
    /** Additionally authorize each cross-document target before mutation. */
    authorizeExternalWrite?: (target: SchemaResolution) => boolean | Promise<boolean>;
}

/** Write an existing resolved schema value. Returns a detached pre-write JSON snapshot. */
export async function setSchemaByPointer(
    value: unknown, pointer: string | string[], root: unknown, options: SchemaWriteOptions
): Promise<unknown> {
    // Validate/snapshot inputs before awaiting a loader or an authorization callback.
    // The raw setter validates once again just before committing the write.
    const target = await resolveSchemaByPointer(pointer, root, options);
    if (!target.point?.parent || target.documentPath.endsWith('#')) {
        throw new Error('Cannot write a schema root or a computed relative key');
    }
    if (target.documentRoot !== root) {
        const registered = options.mutableResources?.get(target.documentURI);
        if (registered !== target.documentRoot || !options.authorizeExternalWrite ||
            !(await options.authorizeExternalWrite(target))) {
            throw new Error(`External schema write is not authorized: ${target.documentURI}`);
        }
    }
    // Authorization is asynchronous. A callback may have replaced a container
    // before we resume: reject a destination that no longer has the identity
    // that was resolved and authorized (the setter itself is synchronous).
    const physicalParent = getReferenceByPointer(target.point.parent.normalizedPath,
        target.documentRoot as Record<string, any>);
    const currentValue = Object.getOwnPropertyDescriptor(physicalParent.obj, target.point.key);
    if (physicalParent.obj !== target.point.parent.obj || !currentValue ||
        !('value' in currentValue) || currentValue.value !== target.value) {
        throw new Error('Schema write target changed during authorization');
    }
    // A schema reference may point to another physical document. Use its verified
    // absolute physical path, not the logical pointer supplied by the caller.
    return setByPointer(value, target.documentPath, target.documentRoot as Record<string, any>);
}