'use strict';

const { TRIMS, GROUPS, RULES } = require('./catalog');

const DEFAULT_TRIM = 's-awd';

function groupById(id) {
  return GROUPS.find((g) => g.id === id);
}

function normalize(args) {
  const trim = TRIMS[args.trim] ? args.trim : DEFAULT_TRIM;
  const sel = { trim };
  for (const g of GROUPS) {
    const known = g.options.some((o) => o.id === args[g.id]);
    sel[g.id] = known ? args[g.id] : g.default;
  }
  return sel;
}

function firstBroken(sel) {
  return RULES.find((r) => r.when(sel)) || null;
}

// Roll back whichever group the broken rule points at, repeatedly, until the
// selection is internally consistent. Returns the rules that fired so the widget
// and the model can both explain what happened.
function reconcile(sel) {
  const dropped = [];
  let guard = 0;
  let broken = firstBroken(sel);
  while (broken && guard < GROUPS.length + 1) {
    const g = groupById(broken.blocks);
    dropped.push({
      rule: broken.id,
      group: g.id,
      removed: sel[g.id],
      revertedTo: g.default,
      reason: broken.reason,
    });
    sel[g.id] = g.default;
    broken = firstBroken(sel);
    guard += 1;
  }
  return dropped;
}

// For every option in every group, ask: would picking this, with everything else
// held constant, break a rule? That answer is what greys out a swatch in the UI.
function availability(sel) {
  return GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    selected: sel[g.id],
    options: g.options.map((o) => {
      const candidate = { ...sel, [g.id]: o.id };
      const broken = firstBroken(candidate);
      return {
        id: o.id,
        label: o.label,
        delta: o.delta,
        ...(o.swatch ? { swatch: o.swatch } : {}),
        available: !broken,
        ...(broken ? { reason: broken.reason } : {}),
      };
    }),
  }));
}

function quote(sel) {
  const base = TRIMS[sel.trim].base;
  const lines = [];
  let options = 0;
  for (const g of GROUPS) {
    const o = g.options.find((x) => x.id === sel[g.id]);
    if (o.delta > 0) {
      lines.push({ group: g.id, label: o.label, amount: o.delta });
      options += o.delta;
    }
  }
  return {
    currency: 'INR',
    base,
    options,
    total: base + options,
    lines,
    disclaimer: 'Ex-showroom Delhi. Registration, insurance and taxes extra.',
  };
}

function buildId(sel) {
  const key = `${sel.trim}|${sel.paint}|${sel.wheels}|${sel.pack}|${sel.roof}`;
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return `b_${Math.abs(h).toString(36)}`;
}

function configure(args = {}) {
  const selections = normalize(args);
  const dropped = reconcile(selections);
  return {
    selections,
    trimLabel: require('./catalog').TRIMS[selections.trim].label,
    dropped,
    groups: availability(selections),
    price: quote(selections),
    buildId: buildId(selections),
  };
}

module.exports = { configure };
