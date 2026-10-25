(() => {
  const form = document.querySelector('#poll-form');
  const button = document.querySelector('#vote-button');
  const status = document.querySelector('#poll-status');
  const names = {ahmet:'Ahmet Tambedou', khoudia:'Khoudia Sow Tall Dioum', dame:'Mouhamadou Dame Diop'};
  let voted = false;
  function render(data) {
    voted = data.voted;
    form.querySelector('fieldset').disabled = voted;
    button.disabled = voted;
    button.textContent = voted ? 'Réponse enregistrée' : 'Envoyer ma réponse →';
    document.querySelector('#poll-results').replaceChildren();
    for (const [id, name] of Object.entries(names)) {
      const count = data.counts[id];
      const pct = data.total ? Math.round(count / data.total * 100) : 0;
      const row = document.createElement('div'); row.className = 'result-row';
      const label = document.createElement('div'); label.className = 'result-label';
      const title = document.createElement('span'); title.textContent = name;
      const value = document.createElement('span'); value.textContent = `${pct} % · ${count}`;
      label.append(title, value);
      const track = document.createElement('div'); track.className = 'result-track';
      const fill = document.createElement('div'); fill.className = 'result-fill'; fill.style.width = `${pct}%`;
      track.append(fill); row.append(label, track); document.querySelector('#poll-results').append(row);
    }
    document.querySelector('#poll-total').textContent = `${data.total} ${data.total === 1 ? 'personne a participé' : 'personnes ont participé'}`;
    status.textContent = voted ? (data.duplicate ? 'Vous avez déjà participé à ce sondage.' : 'Merci ! Votre participation a bien été prise en compte.') : '';
  }
  const endpoint = 'https://aesm-sondage-2026.footmaster-web.workers.dev' + (['localhost','127.0.0.1'].includes(location.hostname) ? '/preview' : '/');
  let token;
  try {
    token = localStorage.getItem('aesm-poll-2026');
    if (!/^[a-f0-9]{64}$/.test(token || '')) {
      token = [...crypto.getRandomValues(new Uint8Array(32))].map(value => value.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('aesm-poll-2026', token);
    }
  } catch {
    status.textContent = 'Autorisez le stockage du navigateur pour participer au sondage.';
    return;
  }
  async function request(method = 'GET', candidate) {
    const response = await fetch(endpoint, {method, cache:'no-store', headers:{'X-Poll-Token':token, ...(method === 'POST' ? {'Content-Type':'application/json'} : {})}, ...(method === 'POST' ? {body:JSON.stringify({candidate})} : {})});
    const data = await response.json();
    if (!response.ok && response.status !== 409) throw new Error(data.error || 'Sondage indisponible.');
    render(data);
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (voted) return;
    const candidate = new FormData(form).get('candidate');
    if (!names[candidate]) return;
    button.disabled = true; status.textContent = 'Enregistrement…';
    try { await request('POST', candidate); }
    catch (error) { status.textContent = 'Impossible d’enregistrer votre réponse. Réessayez.'; button.disabled = false; }
  });
  request().catch(() => { status.textContent = 'Le sondage est indisponible. Rechargez la page pour réessayer.'; });
})();
