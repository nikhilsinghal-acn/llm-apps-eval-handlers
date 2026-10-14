'use strict';

const { configure } = require('./rules');

const SITE = 'https://main--eds-llm-apps-eval--nikhilsinghal-acn.aem.live';

const WIDGET_DESCRIPTION = [
  'The widget renders a live vehicle configurator: paint and wheel swatches, pack and',
  'roof choices, a price panel and a button that opens the full configurator on the',
  'brand site. Unavailable combinations are already greyed out in the widget.',
  'Do NOT list the options or the prices in text. Summarise the build in one sentence,',
  'state any combination that had to be dropped, and offer one next step.',
].join(' ');

/**
 * Adobe LLM Apps handler contract:
 *   receives the validated input arguments as a plain object
 *   returns { content, structuredContent, _meta }
 *
 * `content`           -> read by the model, costs tokens
 * `structuredContent` -> read by the EDS block, costs no tokens
 */
module.exports = async (args = {}) => {
  const build = configure(args);
  const { selections, trimLabel, dropped, groups, price, buildId } = build;

  const paint = groups.find((g) => g.id === 'paint').options
    .find((o) => o.id === selections.paint).label;
  const wheels = groups.find((g) => g.id === 'wheels').options
    .find((o) => o.id === selections.wheels).label;

  const lakhs = (price.total / 100000).toFixed(2);
  const sentences = [
    `${trimLabel} in ${paint} on ${wheels}. Ex-showroom Delhi \u20B9${lakhs} lakh.`,
  ];
  for (const d of dropped) {
    sentences.push(`Dropped ${d.removed} from ${d.group}: ${d.reason}`);
  }

  return {
    content: [{ type: 'text', text: sentences.join(' ') }],
    structuredContent: {
      view: 'configurator',
      model: 'Terra',
      trim: selections.trim,
      trimLabel,
      selections,
      dropped,
      groups,
      price,
      buildId,
      heroImage: `${SITE}/renders/terra/${selections.trim}/${selections.paint}/${selections.wheels}.jpg`,
      deepLink: `${SITE}/configure?build=${buildId}`,
      cta: 'Open in the full configurator',
    },
    _meta: { 'openai/widgetDescription': WIDGET_DESCRIPTION },
  };
};
