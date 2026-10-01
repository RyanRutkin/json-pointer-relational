export const groups = [
  { title: 'Start here', items: [['overview', 'Overview'], ['installation', 'Installation'], ['pointers', 'Pointer syntax'], ['quickstart', 'Quick start']] },
  { title: 'Synchronous · raw JSON', items: [
    ['tokenizeJsonPointer', 'tokenizeJsonPointer'], ['getByPointer', 'getByPointer'],
    ['getReferenceByPointer', 'getReferenceByPointer'], ['setByPointer', 'setByPointer'],
    ['setByPointerWithRef', 'setByPointerWithRef'], ['setByPointerImmutable', 'setByPointerImmutable'],
  ] },
  { title: 'Asynchronous · schema', items: [
    ['resolveSchemaByPointer', 'resolveSchemaByPointer'], ['setSchemaByPointer', 'setSchemaByPointer'],
  ] },
  { title: 'Exported TypeScript types', items: [
    ['RefPoint', 'RefPoint'], ['SchemaResolveOptions', 'SchemaResolveOptions'],
    ['SchemaResolution', 'SchemaResolution'], ['SchemaHop', 'SchemaHop'], ['SchemaWriteOptions', 'SchemaWriteOptions'],
  ] },
  { title: 'Guides', items: [['security', 'Security & limits'], ['migration', 'Migrating from 1.x']] },
];

export const docTopics = groups.flatMap(group => group.items.map(([id, title]) => ({ id, title })));
