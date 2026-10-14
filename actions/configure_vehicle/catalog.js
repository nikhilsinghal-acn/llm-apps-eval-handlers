'use strict';

// Stand-in for the client's PIM / configurator service. In a real engagement this
// module is replaced by an HTTP call to the same rules + pricing API the website and
// the native app already use. Nothing else in the handler changes.

const TRIMS = {
  's-awd': { label: 'S AWD', base: 2640000 },
  'dynamic-se': { label: 'Dynamic SE', base: 3180000 },
};

const GROUPS = [
  {
    id: 'paint',
    label: 'Paint',
    default: 'arctic-white',
    options: [
      { id: 'arctic-white', label: 'Arctic White', delta: 0, swatch: '#EDEDE8' },
      { id: 'slate-grey', label: 'Slate Grey', delta: 95000, swatch: '#8A8E90' },
      { id: 'obsidian-black', label: 'Obsidian Black', delta: 95000, swatch: '#1C1C1E' },
      { id: 'crimson-red', label: 'Crimson Red', delta: 145000, swatch: '#7B1420' },
    ],
  },
  {
    id: 'wheels',
    label: 'Wheels',
    default: 'r20-gloss',
    options: [
      { id: 'r20-gloss', label: '20" gloss silver', delta: 0 },
      { id: 'r21-satin', label: '21" satin dark', delta: 120000 },
      { id: 'r22-black', label: '22" gloss black', delta: 240000 },
    ],
  },
  {
    id: 'pack',
    label: 'Pack',
    default: 'none',
    options: [
      { id: 'none', label: 'No pack', delta: 0 },
      { id: 'black-exterior', label: 'Black Exterior Pack', delta: 185000 },
      { id: 'cold-climate', label: 'Cold Climate Pack', delta: 95000 },
    ],
  },
  {
    id: 'roof',
    label: 'Roof',
    default: 'fixed',
    options: [
      { id: 'fixed', label: 'Fixed roof', delta: 0 },
      { id: 'panoramic', label: 'Panoramic roof', delta: 210000 },
    ],
  },
];

// Each rule is evaluated against a whole candidate selection. `blocks` names the
// group whose value gets rolled back when the rule fires, which is what makes the
// handler safe to call with any argument set the model happens to extract.
const RULES = [
  {
    id: 'r22-requires-dynamic',
    when: (s) => s.wheels === 'r22-black' && s.trim !== 'dynamic-se',
    blocks: 'wheels',
    reason: '22-inch wheels are only offered on Dynamic SE.',
  },
  {
    id: 'black-pack-excludes-white',
    when: (s) => s.pack === 'black-exterior' && s.paint === 'arctic-white',
    blocks: 'pack',
    reason: 'Black Exterior Pack is not offered with Arctic White.',
  },
  {
    id: 'pano-excludes-cold-climate',
    when: (s) => s.roof === 'panoramic' && s.pack === 'cold-climate',
    blocks: 'roof',
    reason: 'Panoramic roof cannot be combined with the Cold Climate Pack.',
  },
  {
    id: 'r22-excludes-cold-climate',
    when: (s) => s.wheels === 'r22-black' && s.pack === 'cold-climate',
    blocks: 'wheels',
    reason: '22-inch wheels are not available with the Cold Climate Pack.',
  },
];

module.exports = { TRIMS, GROUPS, RULES };
