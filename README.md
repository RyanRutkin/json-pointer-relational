# json-pointer-relational
A lightweight JS JSON-Pointer library that provides methods for getting and setting members of a JSON document, with support for relational JSON-Pointers.

## Testing Playground
You can test the functionality of this library at the [JSON-Pointer-Relational Playground](https://ryanrutkin.github.io/json-pointer-relational-playground/).

The playground demonstrates the capabilities of this library.

### Repository playground (current source)

The React playground in [playground/](playground/) imports the library directly from this repository. It lets you edit a JSON document, run `getByPointer`, or supply a JSON value and run `setByPointer`. After a write, the document editor displays the mutated data, and the output shows the previous value and updated document. You can also supply a JSON array of pointer strings to try chained leaflet-relative navigation. Inputs run locally in the browser; the playground does not send them to a server.

From the repository root, install playground dependencies once with `npm run playground:install`, then start it with `npm run playground`. Open the local URL shown by Vite (typically `http://127.0.0.1:5173/json-pointer-relational/`). Use `npm run playground:build` to verify the production build or `npm run playground:preview` to inspect it locally. Playground dependencies are separate from the library and its files are excluded from the npm package.

The [Pages deployment workflow](.github/workflows/playground.yml) builds and publishes only the playground on pushes to `master` or via manual dispatch. After merging, set the repository's **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The site will be served at `https://ryanrutkin.github.io/json-pointer-relational/` once the workflow completes. Publishing the playground does not publish a new npm package.

## Funtionality
This library adheres to the rules for interpretting a json-pointer as laid out by the [RFC 6901 proposed standard](https://datatracker.ietf.org/doc/html/rfc6901), as well as the additional relative json-pointer suggestion as laid out by [Relative JSON Pointer proposal](https://json-schema.org/draft/2020-12/relative-json-pointer#RFC8259).

Relative JSON Pointers follow the linked 2020 draft's syntax: an upward distance (`0`, `1`, etc.), an optional array index shift (`+1` or `-1`), then either a JSON Pointer suffix or a terminal `#` key lookup. Chaining pointers in a `string[]` is a library extension, not part of that draft. A relative pointer is not a URI fragment; `#` alone denotes the document root in this API, while `0#` reads the current key.

This update changes earlier behavior: leading-zero distances or shifts are rejected; computed array keys are numbers rather than strings; `#` after a chained pointer no longer means its relative key (use `0#`); reads of missing members and `/array/-` now fail. URI fragments decode percent escapes, but plain and relative pointers retain literal percent signs. These parsing changes affect callers relying on 1.x permissive behavior.

## Security and compatibility of the current 1.x API

Pointer traversal and writes reject `__proto__`, `constructor`, and `prototype` tokens, even when the names are escaped in an input pointer. This deliberately restricts some otherwise valid JSON property names to prevent writes through JavaScript prototype objects. Inherited members cannot be traversed, and advanced caller-supplied reference trees must point into the supplied document. Untrusted pointers should still be subject to application-level limits on length and depth.

**Important:** The 1.x API implicitly follows `$ref` during both reads and writes. It is intended for trusted schema-style navigation, not for editing arbitrary JSON containing `$ref` properties. Full JSON Schema 2020-12 URI and dynamic-reference resolution and raw-by-default traversal are planned for v2; the current API is not a JSON Schema validator or a full 2020-12 reference resolver.

## Methods

### getByPointer
#### Params
- pointer (pointers)
: `type: string | string[]` - A string representing a JSON Pointer. You may supply an array of strings, where each string represents a full JSON Pointer. Each JSON Pointer will be evaluated from the ending reference of the JSON Pointer before it in this array.
- obj
: `type: Record<string, any>` - A JSON compatible object. This object is expected to be JSON compatible.

#### Return
`type: any` - The result will be the value of the final reference resolved from each pointer. Therefore, the return type could be anything.
[^note]: Attempting to retrieve a non-existent value past the end of an array will result in an error.


### setByPointer
#### Params
- value
: `type: any` - The value to be set at the final reference point reached from resolving all supplied JSON Pointers.
- pointer (pointers)
: `type: string | string[]` - A string representing a JSON Pointer. You may supply an array of strings, where each string represents a full JSON Pointer. Each JSON Pointer will be evaluated from the ending reference of the JSON Pointer before it in this array.
- obj
: `type: Record<string, any>` - A JSON compatible object. This object is expected to be JSON compatible.

#### Return
`type: any` - The result will be the previous value of the final referencer point reached by resolving all supplied JSON Pointers.
[^note]: Unlike `getByPointer`, you may use a JSON Pointer that resolves to the non-existent index at the end of an array.


### getReferenceByPointer
[^note]: For internal use - or a more detailed response
#### Params
- pointer (pointers)
: `type: string | string[]` - A string representing a JSON Pointer. You may supply an array of strings, where each string represents a full JSON Pointer. Each JSON Pointer will be evaluated from the ending reference of the JSON Pointer before it in this array.
- obj
: `type: Record<string, any>` - A JSON compatible object. This object is expected to be JSON compatible.
- tree (optional)
: `type: RefPoint[]` - For internal use. This array represents the path this method has traveled throughout the data tree to arrive at its current node.

#### Return
`type: RefPoint` - A detailed reference to the resolved point in the data tree.

## Types
### RefPoint
#### Members
- obj
: `type: any` - A reference to the represented point within the data tree.
- key
: `type: string` - The member name of this point within the parent object.
- normalizedPath
: `type: string` - A direct path to this node within the data tree. This might not be the same path that was taken to reach this node, but should represent the most direct path.
- parent
: `type: RefPoint | null` - A RefPoint of the immediate parent node, if available. If a `$ref` was resolved, this will represent the immediate parent of the object resolved from the `$ref`.


## Examples

Let's begin with the example object:
```javascript
const jsonObj = {
    "foo": ["bar", "baz"],
    "highly": {
        "nested": {
            "objects": true
        }
    }
}
```

From here, we could navigate to `"baz"` in the document with the JSON Pointer `/foo/1` or `#/foo/1`.
```javascript
console.log(getByPointer('/foo/1', jsonObj));
// baz
```

We could specific another JSON-Pointer that includes a relative prefix in order to begin navigating the document starting from the reference that our last JSON-Pointer resolved to.
Let's say we are on `"baz"`, but we want to access the index before us in our parent array. We could supply `0-1` to get a result of `"bar"`.
```javascript
console.log(getByPointer(['/foo/1', '0-1'], jsonObj))
// bar
```

If we were on `"baz"` and wanted to know the index of the reference we occupied within the parent array, we could ask for the index with `0#`. Array indices are returned as numbers.
```javascript
console.log(getByPointer(['/foo/1', '0#'], jsonObj))
// 1
```

If we were on `"baz"` and wanted to know the member name of the parent array, we could navigate upward to the parent and ask for its key.
```javascript
console.log(getByPointer(['/foo/1', '1#'], jsonObj))
// foo
```

From any point in the tree, we can use our relative prefix to navigate to any other location.
```javascript
console.log(getByPointer(['/foo/1', '2/highly/nested/objects'], jsonObj))
// true
```

JSON-Pointer functionality is the same for setting a value.
```javascript
console.log(getByPointer('/highly/nested/objects', jsonObj))
// true
setByPointer(false, '/highly/nested/objects', jsonObj)
console.log(getByPointer('/highly/nested/objects', jsonObj))
// false
```

We can also use `setByPointer` to create keys that previously did not exist.
[^note]: You can only set a new key within an already existing node in the tree. You cannot create new nested nodes with a JSON Pointer alone, though you can set an object to a new key in an existing node.
```javascript
console.log(getByPointer('/highly', jsonObj))
// {"nested":{"objects":true}}
setByPointer('bar', '/highly/foo', jsonObj)
console.log(getByPointer('/highly', jsonObj))
// {"nested":{"objects":true},"foo":"bar"}
```

You may also use `setByPointer` to append values to the end of an array using the `-` operator.
Writing at an array index equal to its length also appends (for example, writing to `/items/3` when `items` has three elements). Reading that index before the write still fails, and writing beyond the end fails rather than creating sparse entries. Array append is a write-specific library behavior, not an RFC 6901 read requirement.
```javascript
console.log(getByPointer('/foo', jsonObj))
// ["bar","baz"]
setByPointer('added', ['/foo/1', '1/-'], jsonObj)
console.log(getByPointer('/foo', jsonObj))
// ["bar","baz","added"]
```
