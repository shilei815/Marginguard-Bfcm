// Evaluated inside Chromium by browser QA; no runtime application dependency.
export function auditRenderedContrast() {
  const color = (value) => {
    const values = value.match(/[\d.]+/g)?.map(Number);
    if (!values || values.length < 3) throw Error(`Unsupported rendered color: ${value}`);
    return [...values.slice(0, 3), values[3] ?? 1];
  };
  const over = (front, back) => {
    const alpha = front[3] + back[3] * (1 - front[3]);
    return [...front.slice(0, 3).map((v, i) => (v * front[3] + back[i] * back[3] * (1 - front[3])) / alpha), alpha];
  };
  const luminance = (rgb) => rgb.slice(0, 3).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  const background = (el) => {
    const chain = [];
    for (let node = el; node; node = node.parentElement) chain.unshift(node);
    return chain.reduce((bg, node) => over(color(getComputedStyle(node).backgroundColor), bg), [255, 255, 255, 1]);
  };
  const samples = [];
  const record = (el, value, kind, minimum, bg = background(el)) => {
    const foreground = color(value);
    samples.push({ kind, element: el.tagName, class: el.getAttribute('class') || '', text: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 75), foreground: value, background: bg.slice(0, 3).map(Math.round).join(','), ratio: ratio(over(foreground, bg), bg), minimum, disabled: !!el.closest(':disabled,[aria-disabled="true"]') });
  };
  for (const el of document.querySelectorAll('body *')) {
    if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || !el.getClientRects().length) continue;
    const style = getComputedStyle(el);
    if (['SCRIPT', 'STYLE', 'TITLE', 'OPTION'].includes(el.tagName.toUpperCase())) continue;
    const text = [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    const inputText = el.matches('input:not([type=range],[type=checkbox],[type=file]),select');
    if (text || inputText) {
      const size = parseFloat(style.fontSize), bold = parseFloat(style.fontWeight) >= 700;
      record(el, el.namespaceURI.includes('svg') ? style.fill : style.color, 'text', size >= 24 || (bold && size >= 18.6667) ? 3 : 4.5);
    }
    if (el.matches('input[placeholder]') && !el.value) record(el, getComputedStyle(el, '::placeholder').color, 'placeholder', 4.5);
    if (el.matches('input:not([type=range],[type=checkbox],[type=file]),select,button:not(.text-button,.subtle)')) {
      // Border or filled button surface identifies the component against its surroundings.
      const outside = background(el.parentElement);
      const border = color(style.borderTopColor), surface = background(el);
      if (parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== 'none') {
        const best = ratio(over(border, outside), outside) >= ratio(surface, outside) ? style.borderTopColor : style.backgroundColor;
        record(el, best, 'control boundary', 3, outside);
      }
    }
    if (el.matches('svg path[stroke]:not([stroke="none"]),svg circle,svg line[stroke-dasharray],.bar,.legend i')) {
      const paint = el.namespaceURI.includes('svg') ? (el.tagName === 'circle' ? style.fill : style.stroke) : style.backgroundColor;
      if (paint !== 'none') record(el, paint, 'chart mark', 3, background(el.parentElement));
    }
    if (el.matches('.tabs .selected,nav a.active') && style.boxShadow.includes('inset')) {
      record(el, style.boxShadow.match(/rgba?\([^)]+\)/)[0], 'selected-state indicator', 3);
    }
    if (el.matches(':focus-visible') && style.outlineStyle !== 'none') record(el, style.outlineColor, 'focus indicator', 3, background(el.parentElement));
  }
  return { samples, failures: samples.filter(s => s.ratio + Number.EPSILON < s.minimum) };
}
