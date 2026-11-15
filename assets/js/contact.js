/* Le formulaire reste utilisable en POST classique sans JavaScript. */
(function () {
  'use strict';
  var form = document.getElementById('contact-form');
  if (!form || !window.fetch || !window.AbortController || !window.FormData) return;
  var button = document.getElementById('contact-submit');
  var status = document.getElementById('contact-status');
  var busy = false;
  var label = button.innerHTML;
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    // Le piège antispam est aussi contrôlé par le prestataire.
    if (form.elements._honey.value) return;
    busy = true;
    button.disabled = true;
    button.textContent = 'Envoi en cours…';
    form.setAttribute('aria-busy', 'true');
    status.hidden = false;
    status.dataset.state = 'pending';
    status.textContent = 'Votre message est en cours d’envoi. Patientez un instant.';
    var controller = new AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, 20000);
    try {
      var response = await fetch('https://formsubmit.co/ajax/aesmetz221@gmail.com', {
        method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' },
        credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin', signal: controller.signal
      });
      var result = await response.json();
      if (!response.ok || !result || (result.success !== true && result.success !== 'true')) throw new Error('Unconfirmed');
      // Une demande d’activation du destinataire n’est pas un envoi confirmé.
      if (/activat|confirm.{0,30}email/i.test(result.message || '')) throw new Error('Unconfirmed');
      window.location.assign('merci.html');
    } catch (error) {
      status.dataset.state = 'error';
      status.textContent = 'L’envoi n’a pas pu être confirmé. Votre message est conservé dans le formulaire. Vous pouvez réessayer ou nous écrire directement à aesmetz221@gmail.com.';
      status.focus();
    } finally {
      window.clearTimeout(timer);
      busy = false;
      button.disabled = false;
      button.innerHTML = label;
      form.removeAttribute('aria-busy');
    }
  });
})();
