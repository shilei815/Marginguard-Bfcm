// Browser-only QA: keep measurement code out of the application bundle.
export function measureTypography() {
  const selectors = {
    body: 'body', headline: '.heading h1', paragraph: '.heading p',
    caption: '.caption', button: '.secondary', label: '.field',
    value: '.field input', navigation: '.step-nav a, .sidebar nav a',
    disclosure: 'summary', table: 'td', tableHeader: 'th',
    sectionHeading: '.panel h2, .data-strip h2', kpi: '.card strong',
    chartLabel: 'svg text', legend: '.legend, .category-legend',
    warning: '.notice', tierLabel: '.tier-defaults legend',
  };
  return Object.fromEntries(Object.entries(selectors).flatMap(([name, selector]) => {
    const el = [...document.querySelectorAll(selector)].find(e => e.checkVisibility({ checkVisibilityCSS: true }) && e.getClientRects().length);
    if (!el) return [];
    const style = getComputedStyle(el);
    const scale = el.namespaceURI.includes('svg') ? Math.hypot(el.getScreenCTM().a, el.getScreenCTM().b) : 1;
    return [[name, { size: parseFloat(style.fontSize), lineHeight: style.lineHeight, renderedSize: parseFloat(style.fontSize) * scale }]];
  }));
}
