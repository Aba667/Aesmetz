/* Deux parcours distincts ; sans JavaScript, les deux formulaires restent accessibles. */
(function () {
  'use strict';
  var forms = document.querySelectorAll('[data-contact-form]');
  if (!forms.length) return;
  var choices = document.querySelectorAll('[data-contact-location]');
  var panels = document.querySelectorAll('[data-contact-panel]');
  var locationStatus = document.querySelector('[data-location-status]');

  function showForm(zone) {
    panels.forEach(function (panel) { panel.hidden = panel.id !== 'form-' + zone; });
    choices.forEach(function (choice) {
      if (choice.getAttribute('data-contact-location') === zone) choice.setAttribute('aria-current', 'true');
      else choice.removeAttribute('aria-current');
    });
    locationStatus.textContent = zone ? 'Formulaire ' + (zone === 'europe' ? 'Europe' : 'Afrique') + ' affiché. Vous pouvez changer de situation ci-dessus.' : 'Choisissez Europe ou Afrique pour afficher votre formulaire.';
  }
  function zoneFromHash() {
    return location.hash === '#form-europe' ? 'europe' : location.hash === '#form-afrique' ? 'afrique' : null;
  }
  choices.forEach(function (choice) {
    choice.addEventListener('click', function (event) {
      event.preventDefault();
      showForm(choice.getAttribute('data-contact-location'));
      window.history.replaceState(window.history.state, '', choice.getAttribute('href'));
    });
  });
  window.addEventListener('hashchange', function () {
    var zone = zoneFromHash();
    if (zone) showForm(zone);
  });
  showForm(zoneFromHash());

  var agency = document.getElementById('agence');
  var agencyField = document.getElementById('agence_nom_field');
  var agencyName = document.getElementById('agence_nom');
  function updateAgency() {
    var show = agency.value === 'oui';
    agencyField.hidden = !show;
    // Ne pas transmettre un nom saisi auparavant si la réponse devient « Non ».
    agencyName.disabled = !show;
  }
  if (agency && agencyField && agencyName) {
    agency.addEventListener('change', updateAgency);
    updateAgency();
  }

  forms.forEach(function (form) {
    if (!window.fetch || !window.AbortController || !window.FormData) return;
    var button = form.querySelector('[type="submit"]');
    var status = form.querySelector('[data-contact-status]');
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
  });
})();
