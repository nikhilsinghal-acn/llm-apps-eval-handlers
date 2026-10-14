import { createRequire } from 'node:module';
// The trace deliberately spans both repos: it runs the real handler AND the real
// view model the EDS block uses, proving the structuredContent contract end to end.
// Clone the EDS repo as a sibling of this one, or set VIEW_MODEL to its path.
const VIEW_MODEL = process.env.VIEW_MODEL
  ?? '../eds-llm-apps-eval/blocks/vehicle-configurator/view-model.js';

let toViewModel;
try {
  ({ toViewModel } = await import(VIEW_MODEL));
} catch {
  console.error(`Could not load the view model from: ${VIEW_MODEL}

The trace needs the EDS repo's blocks/vehicle-configurator/view-model.js.
Either clone it as a sibling directory:

  git clone https://github.com/nikhilsinghal-acn/eds-llm-apps-eval.git ../eds-llm-apps-eval

or point at it directly:

  VIEW_MODEL=/abs/path/to/view-model.js node trace.mjs
`);
  process.exit(1);
}

const require = createRequire(import.meta.url);
const handler = require('./actions/configure_vehicle/index.js');

// ---------------------------------------------------------------------------
// This is the metadata you enter in the LLM Apps UI. The deploy pipeline turns it
// into actions.json and @adobe/llm-apps-runtime serves it as the tools/list entry.
// Reproduced here so the trace shows the exact descriptor the host sees.
// ---------------------------------------------------------------------------
const TOOL_DESCRIPTOR = {
  name: 'configure_vehicle',
  description: 'Configure a Terra: choose trim, paint, wheels, pack and roof. '
    + 'Returns the valid build, the live ex-showroom price and a link to the full '
    + 'configurator. Use whenever someone wants to build, price or compare a Terra.',
  inputSchema: {
    type: 'object',
    properties: {
      trim: { type: 'string', description: 'Trim code: s-awd or dynamic-se' },
      paint: { type: 'string', description: 'Paint code, e.g. arctic-white' },
      wheels: { type: 'string', description: 'Wheel code, e.g. r20-gloss' },
      pack: { type: 'string', description: 'Pack code, or none' },
      roof: { type: 'string', description: 'Roof code: fixed or panoramic' },
    },
    required: [],
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  _meta: {
    'openai/toolInvocation/invoking': 'Building your Terra\u2026',
    'openai/toolInvocation/invoked': 'Build ready.',
    'openai/outputTemplate': 'https://main--terra--acme.aem.live/eds-widgets/configure-vehicle',
  },
};

// What the content team authored into the block table on the widget page.
const AUTHORED_CONFIG = {
  ctaLabel: 'Build this on veyra site',
  priceNote: 'Ex-showroom Delhi. On-road price shown at checkout.',
  emptyMessage: 'Tell me a trim to start a build.',
};

let step = 0;
const rule = (t) => {
  step += 1;
  console.log(`\n${'\u2500'.repeat(78)}`);
  console.log(`${step}. ${t}`);
  console.log('\u2500'.repeat(78));
};
const j = (o) => console.log(JSON.stringify(o, null, 2));
const bytes = (o) => `${Buffer.byteLength(JSON.stringify(o))} bytes`;

// The runtime validates arguments against inputSchema before the handler runs.
function validate(args, schema) {
  const errs = [];
  for (const [k, v] of Object.entries(args)) {
    const p = schema.properties[k];
    if (!p) { errs.push(`unknown property: ${k}`); continue; }
    if (typeof v !== p.type) errs.push(`${k}: expected ${p.type}, got ${typeof v}`);
  }
  return errs;
}

// Text stand-in for what the EDS block paints. Same view model, same branches.
function paint(vm) {
  if (vm.empty) return `  [ ${vm.message} ]`;
  const out = [`  \u250C\u2500 ${vm.title} ${'\u2500'.repeat(Math.max(0, 52 - vm.title.length))}`];
  out.push(`  \u2502  hero: ${vm.heroImage.replace('https://main--eds-llm-apps-eval--nikhilsinghal-acn.aem.live', '\u2026')}`);
  for (const n of vm.notices) out.push(`  \u2502  (!) ${n}`);
  for (const g of vm.groups) {
    out.push(`  \u2502`);
    out.push(`  \u2502  ${g.label}`);
    for (const o of g.options) {
      const mark = o.selected ? '\u25C9' : (o.disabled ? '\u2715' : '\u25CB');
      const tail = o.disabled ? `  \u2014 ${o.title}` : (o.delta ? `  ${o.delta}` : '');
      out.push(`  \u2502    ${mark} ${o.label}${tail}`);
    }
  }
  out.push(`  \u2502`);
  for (const r of vm.price.rows) out.push(`  \u2502  ${r.label.padEnd(24)} ${r.value}`);
  out.push(`  \u2502  ${'TOTAL'.padEnd(24)} ${vm.price.total}`);
  out.push(`  \u2502  ${vm.price.note}`);
  out.push(`  \u2502  [ ${vm.cta.label} ] \u2192 ${vm.cta.href}`);
  out.push(`  \u2514${'\u2500'.repeat(60)}`);
  return out.join('\n');
}

// A fake bridge, so the real block logic can be exercised without a browser.
function makeBridge(toolResult) {
  return {
    toolResult: Promise.resolve(toolResult),
    applyHostStyles: () => {},
    autoResize: () => {},
    onContextChange: () => {},
    callTool: async (name, args) => {
      console.log(`\n  [widget \u2192 host] callTool("${name}", ${JSON.stringify(args)})`);
      const r = await handler(args);
      console.log('  [host \u2192 widget] structuredContent delivered, no model turn consumed');
      return r;
    },
    sendMessage: (t) => console.log(`\n  [widget \u2192 conversation] sendMessage(${JSON.stringify(t)})`),
  };
}

async function main() {
  rule('User types into ChatGPT');
  console.log('  "I want a Terra in white with the panoramic roof, and I need the');
  console.log('   cold climate pack because I drive to Manali every winter"');

  rule('Host calls tools/list, sees your action');
  j({ jsonrpc: '2.0', id: 1, result: { tools: [TOOL_DESCRIPTOR] } });
  console.log('\n  The description above is the only thing deciding whether the model');
  console.log('  calls you. Nothing else in the stack can compensate for a vague one.');

  rule('Model extracts arguments, host sends tools/call');
  const call1 = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'configure_vehicle',
      arguments: { paint: 'arctic-white', roof: 'panoramic', pack: 'cold-climate' },
    },
  };
  j(call1);
  console.log('\n  Note what the model did NOT send: trim. Omitted parameters are normal.');

  rule('Runtime validates against inputSchema, then routes by name');
  const errs = validate(call1.params.arguments, TOOL_DESCRIPTOR.inputSchema);
  console.log(`  validation: ${errs.length ? errs.join('; ') : 'passed'}`);
  console.log('  route: actions/configure_vehicle/index.js  (inside the single dist/index.js bundle)');

  rule('Handler runs: rules engine reconciles an impossible combination');
  const res1 = await handler(call1.params.arguments);
  console.log('  dropped by the rules engine:');
  j(res1.structuredContent.dropped);

  rule('Handler return value, split two ways');
  console.log(`  content          ${bytes(res1.content)}  \u2192 the model reads this, costs tokens`);
  console.log(`  structuredContent ${bytes(res1.structuredContent)}  \u2192 the widget reads this, costs nothing`);
  console.log('\n  content:');
  j(res1.content);
  console.log('\n  _meta:');
  j(res1._meta);

  rule('What the model says above the card');
  console.log('  Guided by content + the widgetDescription instruction, ChatGPT writes');
  console.log('  something like:\n');
  console.log('    "Panoramic roof and the Cold Climate Pack can\'t be combined, so I kept');
  console.log('     the pack and reverted the roof. Here\'s the build \u2014 want the roof instead?"');

  rule('Widget renders from structuredContent (real block logic, text-mode)');
  const bridge = makeBridge(res1);
  let state = (await bridge.toolResult).structuredContent;
  console.log(paint(toViewModel(state, AUTHORED_CONFIG)));

  rule('User clicks the 22-inch wheels swatch inside the card');
  console.log('  The block merges the patch into the current selections and round-trips.');
  const res2 = await bridge.callTool('configure_vehicle', { ...state.selections, wheels: 'r22-black' });
  state = res2.structuredContent;
  console.log('\n  rules engine response:');
  j(state.dropped);
  console.log('\n' + paint(toViewModel(state, AUTHORED_CONFIG)));
  console.log('\n  The engine rolled the wheels back and said why. The model was never asked,');
  console.log('  and never had a chance to invent a compatible answer. No model turn was');
  console.log('  consumed either \u2014 callTool is a widget-to-server round trip.');

  rule('User types again: "fine, give me the Dynamic SE"');
  const call3 = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'configure_vehicle',
      arguments: { ...state.selections, trim: 'dynamic-se', wheels: 'r22-black' },
    },
  };
  j(call3);
  const res3 = await handler(call3.params.arguments);
  state = res3.structuredContent;
  console.log('\n  dropped:', JSON.stringify(state.dropped.map((d) => d.rule)));
  console.log('\n' + paint(toViewModel(state, AUTHORED_CONFIG)));
  console.log('\n  The trim upgrade cleared the first constraint and exposed a second one:');
  console.log('  22-inch wheels also clash with the Cold Climate Pack. Sequential');
  console.log('  constraint discovery like this is exactly what JSON-LD cannot give you.');

  rule('Same block, same view model, rendered on the website instead');
  console.log('  bridge === undefined, so loadState() hits /api/configure and the click');
  console.log('  handler updates locally. Identical view model, different chrome:\n');
  const webConfig = { ctaLabel: 'Reserve this build', priceNote: 'Ex-showroom Delhi.' };
  console.log(paint(toViewModel(state, webConfig)));

  rule('Handoff');
  console.log(`  buildId  ${state.buildId}`);
  console.log(`  deepLink ${state.deepLink}`);
  console.log('\n  The same buildId opens on the website, in the native app, or at the');
  console.log('  dealer. That shared identifier is what stops the two surfaces diverging.');
  console.log('');
}

main().catch((e) => { console.error(e); process.exit(1); });
