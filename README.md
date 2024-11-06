# json-pointer-relational
A lightweight JS JSON-Pointer library that provides methods for getting and setting members of a JSON document, with support for relational JSON-Pointers.

## Testing Playground
You can test the functionality of this library at the [JSON-Pointer-Relational Playground](https://ryanrutkin.github.io/json-pointer-relational-playground/).

The playground isn't pretty, but it should demonstrate the capabilities of this library.

## Funtionality
This library adheres to the rules for interpretting a json-pointer as laid out by the [RFC 6901 proposed standard](https://datatracker.ietf.org/doc/html/rfc6901), as well as the additional relative json-pointer suggestion as laid out by [Relative JSON Pointer proposal](https://json-schema.org/draft/2020-12/relative-json-pointer#RFC8259).

All examples and rules defined in these documents should be expected to function with the same behavior.

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
- pointer (pointers)
: `type: string | string[]` - A string representing a JSON Pointer. You may supply an array of strings, where each string represents a full JSON Pointer. Each JSON Pointer will be evaluated from the ending reference of the JSON Pointer before it in this array.
- obj
: `type: Record<string, any>` - A JSON compatible object. This object is expected to be JSON compatible.
- tree (optional)
: `type: RefPoint[]` - For internal use. This array represents the path this method has traveled throughout the data tree to arrive at its current node.

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

If we were on `"baz"` and wanted to know the index of the reference we occupied within the parent array, we could ask for the index with `#`.
```javascript
console.log(getByPointer(['/foo/1', '#'], jsonObj))
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
```javascript
console.log(getByPointer('/foo', jsonObj))
// ["bar","baz"]
setByPointer('added', ['/foo/1', '1/-'], jsonObj)
console.log(getByPointer('/foo', jsonObj))
// ["bar","baz","added"]
```
