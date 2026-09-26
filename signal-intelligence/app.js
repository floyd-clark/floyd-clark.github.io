const list = document.querySelector('#signal-list');
const detail = document.querySelector('#signal-detail');
function node(tag, content, className) { const element = document.createElement(tag); element.textContent = content; if (className) element.className = className; return element; }
function row(label, value) { const element = node('div', '', 'detail-row'); element.append(node('dt', label), node('dd', value)); return element; }
function render(scenario, buttons) {
  buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.id === scenario.id)));
  detail.replaceChildren();
  const top = node('div', '', 'detail-top'); top.append(node('span', scenario.id, 'mono'), node('span', scenario.state, 'state'));
  detail.append(top, node('h3', scenario.title), node('p', scenario.summary, 'detail-summary'));
  const facts = node('dl', '', 'detail-grid');
  facts.append(row('Evidence', `${scenario.evidence.id} · ${scenario.evidence.description}`), row('Recorded', scenario.evidence.recorded), row('Supporting signal', scenario.supports), row('Competing evidence', scenario.contradicts), row('Decision', scenario.decision), row('Next check', scenario.next_check));
  detail.append(facts, node('p', `Change condition: ${scenario.change_condition}`, 'change-condition'));
}
fetch('data/examples.json').then(response => { if (!response.ok) throw Error('Unavailable'); return response.json(); }).then(data => {
  if (!Array.isArray(data.scenarios) || !data.scenarios.length) throw Error('Empty dataset');
  const buttons = data.scenarios.map(scenario => { const button = node('button', '', 'signal-button'); button.type = 'button'; button.dataset.id = scenario.id; button.append(node('span', scenario.id, 'mono'), node('strong', scenario.title), node('small', scenario.caption)); button.addEventListener('click', () => render(scenario, buttons)); list.append(button); return button; });
  render(data.scenarios[0], buttons);
}).catch(() => { detail.textContent = 'The examples could not be loaded. Inspect data/examples.json directly.'; });
