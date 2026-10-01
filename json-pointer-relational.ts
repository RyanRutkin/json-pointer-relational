export type RefPoint = {
    obj: any;
    key: string;
    normalizedPath: string;
    parent: RefPoint | null;
    /** A relative key (`0#`) is a computed result, not a writable location. */
    computed?: boolean;
}

// Security restriction for the 1.x API: JSON can contain these keys, but
// following or assigning them through JavaScript's prototype chain is unsafe.
function assertSafeKey(key: string): void {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new Error(`Unsafe JSON Pointer property: ${key}`);
    }
}

function assertSafeContainer(value: any): void {
    const constructor = value && typeof value === 'object'
        ? Object.getOwnPropertyDescriptor(value, 'constructor')?.value
        : undefined;
    if (value === Object.prototype || value === Array.prototype || value === Function.prototype ||
        (typeof constructor === 'function' && constructor.prototype === value)) {
        throw new Error('Unsafe JSON Pointer target: prototype object');
    }
}

function assertTrustedTree(tree: RefPoint[], root: object): void {
    if (!tree.length || tree[0].obj !== root || tree[0].parent !== null) {
        throw new Error('Invalid JSON Pointer reference tree');
    }
    for (const point of tree) {
        const visited = new Set<RefPoint>();
        let current: RefPoint | null = point;
        while (current && current.parent) {
            if (visited.has(current)) throw new Error('Invalid JSON Pointer reference tree');
            visited.add(current);
            const parent: RefPoint = current.parent;
            assertSafeKey(current.key);
            assertSafeContainer(parent.obj);
            if (!parent.obj || typeof parent.obj !== 'object' ||
                !Object.keys(parent.obj).some(key =>
                    key !== '__proto__' && key !== 'constructor' && key !== 'prototype' && parent.obj[key] === current!.obj) &&
                !(current.obj === undefined && !Object.prototype.hasOwnProperty.call(parent.obj, current.key))) {
                throw new Error('Invalid JSON Pointer reference tree');
            }
            current = parent;
        }
        if (!current || current.obj !== root || current.parent !== null) {
            throw new Error('Invalid JSON Pointer reference tree');
        }
    }
}

export function tokenizeJsonPointer(pointer: string): string[] {
    if (pointer === '' || pointer === '#') return ['#'];
    const decoded = pointer.startsWith('#') ? decodeURIComponent(pointer.slice(1)) : pointer;
    if (decoded.startsWith('/')) {
        return ['#', ...decoded.slice(1).split('/').map(unescapeJsonPointerToken)];
    }
    // Relative JSON Pointers are strings, not URI fragment identifiers.
    if (pointer.startsWith('#')) throw new Error(`Invalid JSON Pointer: ${pointer}`);
    const relative = /^(0|[1-9][0-9]*)(?:([+-])(0|[1-9][0-9]*))?(#)?(?=\/|$)/.exec(pointer);
    if (!relative) throw new Error(`Invalid relative JSON Pointer: ${pointer}`);
    const prefix = relative[0];
    const suffix = pointer.slice(prefix.length);
    if (relative[4] && suffix) throw new Error(`Invalid relative JSON Pointer: ${pointer}`);
    if (suffix && !suffix.startsWith('/')) throw new Error(`Invalid relative JSON Pointer: ${pointer}`);
    return [prefix, ...(suffix ? suffix.slice(1).split('/').map(unescapeJsonPointerToken) : [])];
}

const unescapeJsonPointerToken = (token: string) => {
    if (/~(?![01])/.test(token)) throw new Error(`Invalid JSON Pointer escape: ${token}`);
    // First replace ~1 with /, then ~0 with ~ (RFC 6901 §4).
    return String(token).replace(/~1/g, '/').replace(/~0/g, '~');
}

const escapeJsonPointerToken = (token: string) => token.replace(/~/g, '~0').replace(/\//g, '~1');

function physicalChain(point: RefPoint): RefPoint[] {
    const chain: RefPoint[] = [];
    for (let current: RefPoint | null = point; current; current = current.parent) chain.unshift(current);
    return chain;
}

export function getReferenceByPointer(pointer: string, obj: Record<string, any>, tree?: RefPoint[]): RefPoint;
export function getReferenceByPointer(pointers: string[], obj: Record<string, any>, tree?: RefPoint[]): RefPoint;
export function getReferenceByPointer(pointers: string[] | string, obj: Record<string, any>, tree?: RefPoint[]): RefPoint;
export function getReferenceByPointer(pointers: string[] | string, obj: Record<string, any>, tree?: RefPoint[]): RefPoint {
    return resolveReferenceByPointer(pointers, obj, tree);
}

function resolveReferenceByPointer(pointers: string[] | string, obj: Record<string, any>, tree?: RefPoint[], allowFinalArrayAppend = false): RefPoint {
    assertSafeContainer(obj);
    if (tree) assertTrustedTree(tree, obj);
    // Each index of the pointers array acts as a JSON Pointer
    // The first must be based on the root of the document
    // All following pointers may be relative to the last location of the previous pointer
    let refPoints: RefPoint[] = tree || [{
        obj: obj,
        key: '#',
        normalizedPath: '',
        parent: null
    }];
    let curRef = refPoints[refPoints.length - 1];
    // Loop pointers
    if (typeof pointers === 'string') {
        pointers = [pointers];
    }
    for (let pointerIdx = 0; pointerIdx < pointers.length; pointerIdx++) {
        // First, break the pointer into tokens
        const tokens = tokenizeJsonPointer(pointers[pointerIdx]);
        // Begin looping over tokens
        for (let partIdx = 0; partIdx < tokens.length; partIdx++) {
            // First, unescape the token
            const token = tokens[partIdx];
            // The legacy tokenizer has already performed token unescaping and
            // percent-decoding. Check the effective token, not the input text.
            if (partIdx > 0) assertSafeKey(token);
            // Handle document navigation, either directly to the root or relatively
            if (partIdx === 0) {
                // There are plenty of special cases for the beginning of a JSON Pointer
                // Determine where the start of processing should occur
                if (!token || token === '#') {
                    // Token explicitly starts at the beginning of the document
                    // Set reference point
                    refPoints = refPoints.slice(0,1);
                    curRef = refPoints[refPoints.length - 1];
                    continue;
                }
                // Check for relative reference
                const relative = /^(0|[1-9][0-9]*)(?:([+-])(0|[1-9][0-9]*))?(#)?$/.exec(token);
                if (!relative) throw new Error(`Invalid relative JSON Pointer: ${pointers[pointerIdx]}`);
                const depth = Number(relative[1]);
                if (!Number.isSafeInteger(depth) || depth >= refPoints.length) {
                    throw new Error(`Invalid relative JSON Pointer. Exceeded top of parent tree. Pointer ${pointerIdx}. ${pointers[pointerIdx]}`);
                }
                refPoints = refPoints.slice(0, refPoints.length - depth);
                curRef = refPoints[refPoints.length - 1];

                if (relative[2]) {
                    const shift = Number(relative[3]);
                    const parentArr = curRef.parent;
                    if (!Number.isSafeInteger(shift) || !parentArr || !Array.isArray(parentArr.obj) ||
                        !/^(0|[1-9][0-9]*)$/.test(curRef.key)) {
                        throw new Error(`Invalid relative JSON Pointer. Current value is not an array item. Pointer ${pointerIdx}. ${pointers[pointerIdx]}`);
                    }
                    assertSafeContainer(parentArr.obj);
                    const arrIdx = Number(curRef.key) + (relative[2] === '+' ? shift : -shift);
                    if (!Number.isSafeInteger(arrIdx) || arrIdx < 0 || arrIdx >= parentArr.obj.length ||
                        !Object.prototype.hasOwnProperty.call(parentArr.obj, arrIdx)) {
                        throw new Error(`Invalid relative JSON Pointer. Shifted index out of bounds. Pointer ${pointerIdx}. ${pointers[pointerIdx]}`);
                    }
                    curRef = {
                        obj: parentArr.obj[arrIdx], key: String(arrIdx),
                        normalizedPath: `${parentArr.normalizedPath}/${arrIdx}`, parent: parentArr
                    };
                    refPoints = physicalChain(curRef);
                }
                if (relative[4]) {
                    if (!curRef.parent || partIdx !== tokens.length - 1 || pointerIdx !== pointers.length - 1) {
                        throw new Error('Invalid relative JSON Pointer. Relative key must be terminal and have a parent.');
                    }
                    return {
                        obj: Array.isArray(curRef.parent.obj) ? Number(curRef.key) : curRef.key,
                        key: '#', normalizedPath: `${curRef.normalizedPath}#`, parent: curRef, computed: true
                    };
                }
                // End logic for pre-navigation
                continue;
            }
            // Proceed with regular JSON Pointer resolution
            if (Array.isArray(curRef.obj)) {
                assertSafeContainer(curRef.obj);
                if (token !== '-' && !/^(0|[1-9][0-9]*)$/.test(token)) {
                    throw new Error(`Invalid JSON Pointer. Arrays must be indexed by numeric indices. Pointer ${pointerIdx}. ${ pointers[pointerIdx] }`);
                }
                const isFinalWriteTarget = allowFinalArrayAppend &&
                    pointerIdx === pointers.length - 1 && partIdx === tokens.length - 1;
                if (token === '-') {
                    if (!isFinalWriteTarget) throw new Error('Invalid JSON Pointer. Cannot read or descend through array append position.');
                    refPoints.push({
                        obj: undefined,
                        key: '-',
                        normalizedPath: `${curRef.normalizedPath}/-`,
                        parent: curRef
                    });
                    curRef = refPoints[refPoints.length - 1];
                    // End logic for Array
                    continue;
                }

                const numToken = Number(token);
                // A setter may append at index === length, but only at its
                // final destination. Reads and intermediate hops still fail.
                if (!Number.isSafeInteger(numToken) || numToken > curRef.obj.length ||
                    (numToken === curRef.obj.length && !isFinalWriteTarget) ||
                    (numToken < curRef.obj.length && !Object.prototype.hasOwnProperty.call(curRef.obj, numToken))) {
                    throw new Error(`Invalid JSON Pointer. Referenced index exceeds parent array length. Pointer ${pointerIdx}. ${ pointers[pointerIdx] }`);
                }
                const prevRef = refPoints[refPoints.length - 1];
                refPoints.push({
                    obj: curRef.obj[numToken],
                    key: token,
                    normalizedPath: `${prevRef.normalizedPath}/${String(numToken)}`,
                    parent: curRef
                });
                curRef = refPoints[refPoints.length - 1];
                // End logic for Array
                continue;
            }
            if (!curRef.obj || typeof curRef.obj !== 'object') {
                throw new Error(`Invalid JSON Pointer. Attempt to index non-object. Pointer ${pointerIdx}. ${ pointers[pointerIdx] }`);
            }
            assertSafeContainer(curRef.obj);
            if (!Object.prototype.hasOwnProperty.call(curRef.obj, token) &&
                (partIdx < tokens.length - 1 || pointerIdx < pointers.length - 1 || !allowFinalArrayAppend)) {
                throw new Error(`Invalid JSON Pointer. Cannot read or traverse missing property: ${token}`);
            }
            // Handle $ref
            // TODO - Test for infinite recursion error. Will it break?
            let newRef = Object.prototype.hasOwnProperty.call(curRef.obj, token) ? curRef.obj[token] : undefined;
            if (newRef && typeof newRef === 'object' && !Array.isArray(newRef) &&
                Object.prototype.hasOwnProperty.call(newRef, '$ref') && newRef['$ref']) {
                const resolvedRef = getReferenceByPointer([newRef['$ref']], obj, refPoints);
                // Use parent from the resolved ref
                // If we were to set a value using a path that required a resolved ref,
                // the tree referenced would need to be from the resolved area downward.
                // A reference hop changes the physical location. Relative
                // pointers subsequently ascend from that location, not the alias.
                refPoints = physicalChain(resolvedRef);
            } else {
                const prevRef = refPoints[refPoints.length - 1];
                refPoints.push({
                    obj: newRef,
                    key: token,
                    normalizedPath: `${prevRef.normalizedPath}/${escapeJsonPointerToken(token)}`,
                    parent: prevRef
                });
            }
            curRef = refPoints[refPoints.length - 1];
            // End logic for Object
        }
    }
    return curRef;
}

export function getByPointer(pointer: string, obj: Record<string, any>): any;
export function getByPointer(pointers: string[], obj: Record<string, any>): any;
export function getByPointer(pointers: string[] | string, obj: Record<string, any>): any;
export function getByPointer(pointers: string[] | string, obj: Record<string, any>): any {
    const ref = getReferenceByPointer(pointers, obj);
    return ref.obj;
}

export function setByPointerWithRef(value: any, pointer: string, obj: Record<string, any>, tree?: RefPoint[]): any;
export function setByPointerWithRef(value: any, pointers: string[], obj: Record<string, any>, tree?: RefPoint[]): any;
export function setByPointerWithRef(value: any, pointers: string[] | string, obj: Record<string, any>, tree?: RefPoint[]): any;
export function setByPointerWithRef(value: any, pointers: string[] | string, obj: Record<string, any>, tree?: RefPoint[]): any {
    const ref = resolveReferenceByPointer(pointers, obj, tree, true);
    if (ref.computed) throw new Error('Invalid JSON Pointer for SET. A relative key is not a writable location.');
    if (!ref.parent) {
        // throw new Error('Invalid JSON Pointer for SET. Cannot set root document');
        // Oddly, there are some instances where setting the root document through this method makes sense.
        obj = value;
        return obj;
    }
    assertSafeKey(ref.key);
    assertSafeContainer(ref.parent.obj);
    if (ref.parent.obj === null || typeof ref.parent.obj !== 'object') {
        throw new Error('Invalid JSON Pointer for SET. Parent is not an object');
    }
    if (Array.isArray(ref.parent.obj) && ref.key === '-') {
        ref.parent.obj.push(value);
    } else if (Array.isArray(ref.parent.obj)) {
        ref.parent.obj[parseInt(ref.key)] = value;
    } else if (typeof ref.parent.obj === 'object') {
        ref.parent.obj[ref.key] = value;
    } else {
        throw new Error(`Invalid JSON Pointer for SET. Cannot set property ${ref.key} of ${typeof ref.parent}`);
    }
    return ref;
}

export function setByPointer(value: any, pointer: string, obj: Record<string, any>): any;
export function setByPointer(value: any, pointers: string[], obj: Record<string, any>): any;
export function setByPointer(value: any, pointers: string[] | string, obj: Record<string, any>): any;
export function setByPointer(value: any, pointers: string[] | string, obj: Record<string, any>): any {
    const ref = setByPointerWithRef(value, pointers, obj);
    return ref.obj;
}
