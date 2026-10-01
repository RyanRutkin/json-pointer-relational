import { useEffect, useState } from 'react';
import { getByPointer, setByPointer, resolveSchemaByPointer, setSchemaByPointer } from '../../index.ts';
import { Docs } from './Docs.jsx';
import { docTopics } from './doc-topics.js';

const initialData = JSON.stringify({
  $defs: {
    person: { type: 'string', title: 'Display name' },
  },
  properties: {
    name: { $ref: '#/$defs/person' },
  },
  items: ['first', 'second', 'third'],
}, null, 2);

const initialPointer = '/items/1';
const initialValue = '"number"';
const schemaExample = JSON.stringify({
  $id: 'https://example.test/playground',
  $defs: { person: { type: 'string', title: 'Display name' } },
  properties: { name: { $ref: '#/$defs/person' } },
}, null, 2);

function parsePointer(input) {
  // Chained pointer arrays are a library extension; plain pointers remain literal.
  if (!input.trimStart().startsWith('[')) return input;
  const pointers = JSON.parse(input);
  if (!Array.isArray(pointers) || !pointers.length || !pointers.every(item => typeof item === 'string')) {
    throw new Error('A pointer array must contain at least one string.');
  }
  return pointers;
}

function formatResult(value) {
  return value === undefined ? 'undefined' : JSON.stringify(value, null, 2);
}

function Playground() {
  const [data, setData] = useState(initialData);
  const [pointer, setPointer] = useState(initialPointer);
  const [value, setValue] = useState(initialValue);
  const [output, setOutput] = useState('Run an operation to see its result here.');
  const [status, setStatus] = useState('Ready');
  const [operation, setOperation] = useState('');
  const [mode, setMode] = useState('raw');
  const [baseURI, setBaseURI] = useState('https://example.test/playground');

  async function run(kind) {
    setOperation(kind);
    try {
      const document = JSON.parse(data);
      const path = parsePointer(pointer);

      if (kind === 'get') {
        if (mode === 'schema') {
          const result = await resolveSchemaByPointer(path, document, { baseURI });
          setOutput(`${formatResult(result.value)}\n\nResource: ${result.resourceURI}\nPhysical path: ${result.documentPath || '(root)'}\nReference hops: ${result.hops.length}`);
        } else {
          setOutput(formatResult(getByPointer(path, document)));
        }
        setStatus('Read complete');
      } else {
        const nextValue = JSON.parse(value);
        const previous = mode === 'schema'
          ? await setSchemaByPointer(nextValue, path, document, { baseURI })
          : setByPointer(nextValue, path, document);
        setData(JSON.stringify(document, null, 2));
        setOutput(`Previous value:\n${formatResult(previous)}\n\nUpdated document:\n${formatResult(document)}`);
        setStatus('Write complete');
      }
    } catch (error) {
      setStatus('Error');
      setOutput(`${error instanceof Error ? error.name : 'Error'}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function reset() {
    setData(initialData);
    setPointer(initialPointer);
    setValue(initialValue);
    setOutput('Run an operation to see its result here.');
    setStatus('Ready');
    setOperation('');
    setMode('raw');
  }

  function loadSchemaExample() {
    setData(schemaExample);
    setMode('schema');
    setPointer('/properties/name/type');
    setValue('"number"');
    setOutput('Run an operation to follow the local schema reference.');
    setStatus('Ready');
    setOperation('');
  }

  return (
      <main className="main-content" id="playground-content" tabIndex={-1}>
        <div className="intro">
          <div className="eyebrow"><span className="live-dot" /> INTERACTIVE WORKSPACE</div>
          <h1>Explore every <span>leaflet.</span></h1>
          <p>Follow a pointer through your JSON, or write a new value and inspect exactly what changed. This playground runs the library directly in your browser.</p>
        </div>

        <div className="workspace">
          <section className="panel editor-panel" aria-labelledby="data-label">
            <div className="panel-heading">
              <div><span className="panel-number">01</span><h2 id="data-label">Document</h2></div>
              <span className="file-badge">JSON</span>
            </div>
            <p className="panel-subtitle">Start with the example or paste your own data.</p>
            <textarea className="code-area document-area" aria-label="Initial data (JSON)" spellCheck="false" value={data} onChange={event => setData(event.target.value)} />
          </section>

          <section className="panel controls-panel" aria-labelledby="pointer-label">
            <div className="panel-heading"><div><span className="panel-number">02</span><h2 id="pointer-label">Navigate</h2></div></div>
            <p className="panel-subtitle">Point to a value, or chain pointers to navigate relative to a leaflet.</p>
            <div className="mode-select" role="group" aria-label="Navigation mode">
              <button type="button" aria-pressed={mode === 'raw'} onClick={() => setMode('raw')}>Raw JSON</button>
              <button type="button" aria-pressed={mode === 'schema'} onClick={() => setMode('schema')}>Schema refs</button>
            </div>
            {mode === 'schema' && <>
              <label htmlFor="baseURI">Base URI</label>
              <input id="baseURI" className="text-input" spellCheck="false" value={baseURI} onChange={event => setBaseURI(event.target.value)} />
              <p className="field-help">Local references only. No external resources are fetched.</p>
            </>}
            <label htmlFor="pointer">JSON pointer</label>
            <input id="pointer" className="text-input" spellCheck="false" value={pointer} onChange={event => setPointer(event.target.value)} placeholder="/properties/name/type" />
            <p className="field-help">Try <code>/items/1</code>, <code>["/items/1","0-1"]</code>, or <code>["/items/1","0#"]</code> for the index. To append, set <code>/items/3</code> or <code>/items/-</code>.</p>
            <button className="button button-primary" type="button" onClick={() => run('get')}><span>↗</span> Run {mode === 'schema' ? 'resolveSchemaByPointer' : 'getByPointer'}</button>

            <div className="divider"><span>WRITE A VALUE</span></div>
            <label htmlFor="value">Value to set <span className="label-hint">· JSON</span></label>
            <textarea id="value" className="code-area value-area" spellCheck="false" value={value} onChange={event => setValue(event.target.value)} placeholder='"new value"' />
            <p className="field-help">Strings need quotes. Objects, arrays, numbers, booleans, and null work too.</p>
            <button className="button button-secondary" type="button" onClick={() => run('set')}><span>✳</span> Run {mode === 'schema' ? 'setSchemaByPointer' : 'setByPointer'}</button>
            <button className="reset-button" type="button" onClick={loadSchemaExample}>↗ Load schema reference example</button>
            <button className="reset-button" type="button" onClick={reset}>↺ Reset example</button>
          </section>

          <section className="panel output-panel" aria-labelledby="output-label">
            <div className="panel-heading"><div><span className="panel-number">03</span><h2 id="output-label">Output</h2></div><span className={`status ${status === 'Error' ? 'status-error' : ''}`}>{status}</span></div>
            <p className="panel-subtitle" aria-live="polite">{operation === 'set' ? 'Previous value and mutated document' : operation === 'get' ? 'Resolved value at your pointer' : 'The result of your next operation appears below.'}</p>
            <textarea className="code-area output-area" aria-label="Output" aria-live="polite" readOnly value={output} />
          </section>
        </div>

        <p className="footnote">A write updates the document editor. Raw navigation treats <code>$ref</code> literally; schema mode follows references explicitly. This playground only resolves local resources and does not fetch external schemas. No data leaves your browser.</p>
      </main>
  );
}

function currentRoute() {
  const hash = window.location.hash;
  if (hash === '#/docs' || hash === '#/docs/') return { page: 'docs', topic: 'overview' };
  if (hash.startsWith('#/docs/')) {
    const topic = hash.slice('#/docs/'.length);
    return { page: 'docs', topic: docTopics.some(item => item.id === topic) ? topic : 'overview' };
  }
  return { page: 'playground', topic: 'overview' };
}

export function App() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const onHashChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <div className="app-shell">
      <button className="skip-link" type="button" onClick={() => document.getElementById(route.page === 'docs' ? 'docs-content' : 'playground-content')?.focus()}>Skip to content</button>
      <header className="topbar">
        <a className="brand" href="#/playground" aria-label="json-pointer-relational playground">
          <span className="brand-mark">/</span>
          <span>json-pointer<span className="brand-muted">-relational</span></span>
        </a>
        <nav className="header-nav" aria-label="Main navigation">
          <a href="#/playground" aria-current={route.page === 'playground' ? 'page' : undefined}>Playground</a>
          <a href="#/docs/overview" aria-current={route.page === 'docs' ? 'page' : undefined}>Docs</a>
          <a className="repo-link" href="https://github.com/RyanRutkin/json-pointer-relational" target="_blank" rel="noreferrer">View source ↗</a>
        </nav>
      </header>
      <div hidden={route.page !== 'playground'}><Playground /></div>
      {route.page === 'docs' && <Docs topicId={route.topic} />}
    </div>
  );
}