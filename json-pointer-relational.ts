export type RefPoint = {
    obj: any;
    key: string;
    normalizedPath: string;
    parent: RefPoint | null;
}

function isNumeric(n: any): n is number {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

const tokenizeJsonPointer = (pointer: string) => {
    return pointer.split(/\//).map(item => {
        const unescapedToken = unescapeJsonPointerToken(item);
        try {
            return decodeURI(unescapedToken);
        } catch(_) {
            return unescapedToken;
        }
    });
}

const parseNavToken = (refToken: string) => {
    return refToken.match(/\d+|-|\+|#/g);
}

const unescapeJsonPointerToken = (token: string) => {
    // First replace ~1 with /, then ~0 with ~
    return String(token).replace(/~1/g, '/').replace(/~0/g, '~');
}

export function getReferenceByPointer(pointer: string, obj: Record<string, any>, tree?: RefPoint[]): RefPoint;
export function getReferenceByPointer(pointers: string[], obj: Record<string, any>, tree?: RefPoint[]): RefPoint;
export function getReferenceByPointer(pointers: string[] | string, obj: Record<string, any>, tree?: RefPoint[]): RefPoint;
export function getReferenceByPointer(pointers: string[] | string, obj: Record<string, any>, tree?: RefPoint[]): RefPoint {
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
                // If this is the first pointer in the array of pointers, we have an invalid reference. Reject.
                if (pointerIdx === 0) {
                    throw new Error(`JSON Pointer invalid. Pointer 0. ${ pointers[0] }`);
                }
                // Check for relative reference
                const navTokens = parseNavToken(token);
                if (!navTokens) {
                    // The only thing that should be prefixing a JSON Pointer at this point is a relative reference
                    // This is an error state and the JSON Pointer is invalid.
                    throw new Error(`JSON Pointer invalid. Pointer ${pointerIdx}. ${ pointers[pointerIdx] }`);
                }
                for (let navTokenIdx = 0; navTokenIdx < navTokens.length; navTokenIdx++) {
                    const navToken = navTokens[navTokenIdx];
                    if (navToken === '#' && navTokenIdx < navTokens.length-1) {
                        throw new Error(`Invalid relative JSON Pointer. Cannot index into relative key. Pointer ${pointerIdx}. ${ pointers[pointerIdx] }`);
                    }
                    if (navToken === '#' && refPoints.length === 1) {
                        throw new Error(`Invalid relative JSON Pointer. No relative key for document root. Pointer ${pointerIdx}. ${ pointers[pointerIdx] }`);
                    }
                    if (navToken === '#' && (tokens.length > 1 || pointerIdx < pointers.length-1)) {
                        // Getting the current relative key is the end of the line. There can't be anything after this
                        throw new Error(`Invalid relative JSON Pointer. Cannot index into relative key.`);
                    }
                    if (navToken === '#') {
                        // End of the line. Return the key of the current location.
                        return {
                            obj: curRef.key,
                            key: '#',
                            normalizedPath: `#`,
                            parent: curRef.obj
                        };
                    }
                    if (isNumeric(navToken)) {
                        const numDocRef = parseInt(navToken);
                        if (numDocRef > refPoints.length) {
                            // Tree reversal exceeded hierarchy. Reject.
                            throw new Error(`Invalid relative JSON Pointer. Exceeded top of parent tree. Pointer ${pointerIdx}. ${ pointers[pointerIdx] }`);
                        }
                        refPoints = refPoints.slice(0, refPoints.length - numDocRef);
                        curRef = refPoints[refPoints.length - 1];
                        continue;
                    }
                    // If the value isn't numeric, it must be moving back or forward in an array
                    // Our parent must be an array
                    if (refPoints.length < 2) {
                        // There is no parent array if there is no parent
                        throw new Error(`Invalid relative JSON Pointer. Parent is not an array. Pointer ${pointerIdx}. ${ pointers[pointerIdx] }`);
                    }
                    const parentArr = refPoints[refPoints.length - 2];
                    if (!Array.isArray(parentArr.obj)) {
                        throw new Error(`Invalid relative JSON Pointer. Parent is not an array. Pointer ${pointerIdx}. ${ pointers[pointerIdx] }`);
                    }
                    // At this point, our current nav token must either be + or -
                    // Look forward to the next nav token and ensure it is numeric
                    if (navTokenIdx === navTokens.length - 1) {
                        throw new Error(`Invalid relative JSON Pointer. No amount of index shift provided in relative navigation. Pointer ${pointerIdx}. ${ pointers[pointerIdx] }`);
                    }
                    if (!isNumeric(navTokens[navTokenIdx+1])) {
                        throw new Error(`Invalid relative JSON Pointer. Index shift must be numeric. Pointer ${pointerIdx}. ${ pointers[pointerIdx] }`);
                    }
                    const indexShift = parseInt(navTokens[navTokenIdx+1]);
                    // Increase index to skip next navToken
                    navTokenIdx++;
                    // Since our parent is an array, our curRef.key is a array index
                    const arrIdx = parseInt(curRef.key)+(navToken === '+' ? indexShift : -1*indexShift);
                    if (arrIdx < 0 || arrIdx > parentArr.obj.length-1) {
                        throw new Error(`Invalid relative JSON Pointer. Index exceeds parent arround bounds. Pointer ${pointerIdx}. ${ pointers[pointerIdx] }`);
                    }
                    // Snip off the last point in refPoints
                    refPoints = refPoints.slice(0, refPoints.length - 2);
                    // Add on the new point as the current array index
                    const prevPoint = refPoints[refPoints.length - 1];
                    refPoints.push({
                        obj: parentArr.obj[arrIdx],
                        key: String(arrIdx),
                        normalizedPath: `${prevPoint.normalizedPath}/${String(arrIdx)}`,
                        parent: parentArr
                    });
                    curRef = refPoints[refPoints.length - 1];
                }
                // End logic for pre-navigation
                continue;
            }
            // Proceed with regular JSON Pointer resolution
            if (Array.isArray(curRef.obj)) {
                const navTokens = parseNavToken(token);
                // This should result in an array with a single element, being numeric
                // Per the spec "-" is valid for referencing the non-existent element
                // past the end of the array, but also that it will always result in
                // an error condition.
                if (!navTokens || navTokens.length > 1 || (navTokens[0] !== '-' && !isNumeric(navTokens[0]))) {
                    throw new Error(`Invalid JSON Pointer. Arrays must be indexed by numeric indices. Pointer ${pointerIdx}. ${ pointers[pointerIdx] }`);
                }
                // We only want the json pointer to fail on - if we are doing a get and not a set
                // Therefore, this method should succeed, and the caller should return the error
                if (navTokens[0] === '-') {
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

                const numToken = parseInt(navTokens[0]);
                if (numToken >= curRef.obj.length) {
                    throw new Error(`Invalid JSON Pointer. Referenced index exceeds parent array length. Pointer ${pointerIdx}. ${ pointers[pointerIdx] }`);
                }
                const prevRef = refPoints[refPoints.length - 1];
                refPoints.push({
                    obj: curRef.obj[numToken],
                    key: String(numToken),
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
            // Handle $ref
            // TODO - Test for infinite recursion error. Will it break?
            let newRef = curRef.obj[token];
            if (newRef && typeof newRef === 'object' && !Array.isArray(newRef) && newRef['$ref']) {
                const resolvedRef = getReferenceByPointer([newRef['$ref']], obj, refPoints);
                // Use parent from the resolved ref
                // If we were to set a value using a path that required a resolved ref,
                // the tree referenced would need to be from the resolved area downward.
                refPoints.push({
                    ...resolvedRef,
                    key: token
                });
            } else {
                const prevRef = refPoints[refPoints.length - 1];
                refPoints.push({
                    obj: newRef,
                    key: token,
                    normalizedPath: `${prevRef.normalizedPath}/${token}`,
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
    if (Array.isArray(ref.parent) && ref.key === '-') {
        throw new Error(`Invalid JSON Pointer. Referenced index exceeds parent array length.`);
    }
    return ref.obj;
}

export function setByPointer(value: any, pointer: string, obj: Record<string, any>): any;
export function setByPointer(value: any, pointers: string[], obj: Record<string, any>): any;
export function setByPointer(value: any, pointers: string[] | string, obj: Record<string, any>): any;
export function setByPointer(value: any, pointers: string[] | string, obj: Record<string, any>): any {
    const ref = getReferenceByPointer(pointers, obj);
    if (!ref.parent) {
        throw new Error('Invalid JSON Pointer for SET. Cannot set root document');
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
    return ref.obj;
}
