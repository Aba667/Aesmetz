/* =============================================================================
   AESM — Gestion du consentement aux traceurs
   -----------------------------------------------------------------------------
   Bandeau + modale de préférences, en JavaScript natif, sans dépendance.
   À charger en « defer » : <script src="assets/js/consent.js" defer></script>

   Cadre : article 82 de la loi Informatique et Libertés et recommandations
   de la CNIL sur les cookies et autres traceurs.
     - refuser doit être aussi simple qu'accepter (mêmes boutons, même poids) ;
     - pas de « cookie wall » : le bandeau ne bloque pas la lecture du site ;
     - le choix est conservé six mois, puis la question est reposée ;
     - le choix peut être modifié à tout moment (élément [data-cookie-settings]).

   État actuel du site : aucun traceur de mesure d'audience, aucun cookie
   publicitaire, aucun contenu tiers embarqué. Le seul stockage est la clé
   « aesm_consent_v1 » ci-dessous, qui relève de l'exemption « strictement
   nécessaire ». Les deux autres catégories sont présentées par avance :
   le choix est enregistré et sera respecté si de tels outils sont ajoutés.
   ============================================================================= */

(function () {
  'use strict';

  /* ==========================================================================
     1. Configuration
     ========================================================================== */

  /** Clé de stockage dans localStorage. */
  var CLE_STOCKAGE = 'aesm_consent_v1';

  /** Version du format enregistré. Incrémenter invalide les choix antérieurs. */
  var VERSION = 1;

  /** Durée de validité du choix, en mois (recommandation CNIL : 6 mois). */
  var DUREE_VALIDITE_MOIS = 6;

  /**
   * Catégories proposées.
   *  - `id`          : clé utilisée dans l'objet `choix` enregistré ;
   *  - `obligatoire` : catégorie exemptée de consentement, non désactivable ;
   *  - `defaut`      : valeur au premier affichage (refus par défaut).
   */
  var CATEGORIES = [
    {
      id: 'necessaire',
      obligatoire: true,
      defaut: true,
      titre: 'Strictement nécessaires',
      texte: 'Ils font fonctionner le site et mémorisent la réponse que vous ' +
             'donnez ici, pour ne pas vous reposer la question à chaque page. ' +
             'La loi les dispense de consentement : ils ne peuvent pas être désactivés.'
    },
    {
      id: 'mesure_audience',
      obligatoire: false,
      defaut: false,
      titre: 'Mesure d’audience',
      texte: 'Ils serviraient à compter les visites et à repérer les pages ' +
             'réellement utiles, sans publicité ni revente de données. ' +
             'Aucun outil de ce type n’est installé aujourd’hui : votre choix ' +
             'est enregistré par avance et sera respecté si nous en ajoutons un.'
    },
    {
      id: 'reseaux_sociaux',
      obligatoire: false,
      defaut: false,
      titre: 'Contenus des réseaux sociaux',
      texte: 'Ils autoriseraient l’affichage direct de publications Instagram, ' +
             'TikTok ou YouTube à l’intérieur de nos pages. Aujourd’hui nous ne ' +
             'mettons que de simples liens, qui ne déposent rien tant que vous ' +
             'ne cliquez pas : votre choix est enregistré par avance.'
    }
  ];

  /* Identifiants des éléments injectés, pour éviter les doublons. */
  var ID_BANDEAU = 'aesm-cookie-banner';
  var ID_MODALE = 'aesm-cookie-modal';
  var ID_TITRE_MODALE = 'aesm-cookie-modal-title';

  /* Références conservées entre les fonctions. */
  var bandeau = null;
  var modale = null;
  var panneau = null;
  var elementDeclencheur = null; // élément à qui rendre le focus à la fermeture

  /* ==========================================================================
     2. Petits utilitaires
     ========================================================================== */

  /**
   * Retrouve le chemin de la page « politique de cookies » tel qu'il est écrit
   * dans le pied de page. Évite de casser les liens depuis un sous-dossier
   * (les pages de `articles/` utilisent « ../politique-cookies.html »).
   */
  function lienPolitiqueCookies() {
    var lien = document.querySelector('a[href$="politique-cookies.html"]');
    return lien ? lien.getAttribute('href') : 'politique-cookies.html';
  }

  /** Crée un élément avec des attributs et un contenu HTML optionnels. */
  function creer(balise, attributs, html) {
    var el = document.createElement(balise);
    if (attributs) {
      Object.keys(attributs).forEach(function (nom) {
        el.setAttribute(nom, attributs[nom]);
      });
    }
    if (html != null) el.innerHTML = html;
    return el;
  }

  /** Lecture protégée du localStorage (mode privé, stockage désactivé…). */
  function lireStockage() {
    try {
      return window.localStorage.getItem(CLE_STOCKAGE);
    } catch (e) {
      return null;
    }
  }

  /** Écriture protégée du localStorage. Renvoie true si l'écriture a réussi. */
  function ecrireStockage(valeur) {
    try {
      window.localStorage.setItem(CLE_STOCKAGE, valeur);
      return true;
    } catch (e) {
      return false;
    }
  }

  /** Suppression protégée du localStorage. */
  function effacerStockage() {
    try {
      window.localStorage.removeItem(CLE_STOCKAGE);
    } catch (e) {
      /* rien à faire : le navigateur refuse le stockage */
    }
  }

  /** Objet de choix par défaut (tout refusé sauf le strictement nécessaire). */
  function choixParDefaut() {
    var choix = {};
    CATEGORIES.forEach(function (cat) {
      choix[cat.id] = cat.obligatoire ? true : cat.defaut;
    });
    return choix;
  }

  /* ==========================================================================
     3. Lecture et écriture du consentement
     ========================================================================== */

  /**
   * Renvoie l'enregistrement complet s'il est valide, sinon `null`.
   * Un enregistrement est invalide s'il est illisible, d'une autre version,
   * ou daté de plus de six mois.
   */
  function lireEnregistrement() {
    var brut = lireStockage();
    if (!brut) return null;

    var donnees;
    try {
      donnees = JSON.parse(brut);
    } catch (e) {
      return null; // contenu corrompu
    }

    if (!donnees || typeof donnees !== 'object') return null;
    if (donnees.version !== VERSION) return null;
    if (!donnees.choix || typeof donnees.choix !== 'object') return null;

    var enregistreLe = new Date(donnees.date);
    if (isNaN(enregistreLe.getTime())) return null;

    // Expiration : six mois après la date d'enregistrement.
    var expiration = new Date(enregistreLe.getTime());
    expiration.setMonth(expiration.getMonth() + DUREE_VALIDITE_MOIS);
    if (Date.now() > expiration.getTime()) return null;

    // On complète avec les catégories éventuellement ajoutées depuis.
    var choix = choixParDefaut();
    CATEGORIES.forEach(function (cat) {
      if (cat.obligatoire) {
        choix[cat.id] = true;
      } else if (typeof donnees.choix[cat.id] === 'boolean') {
        choix[cat.id] = donnees.choix[cat.id];
      }
    });

    return { version: donnees.version, date: donnees.date, choix: choix };
  }

  /**
   * Enregistre un choix, ferme l'interface et prévient le reste du site.
   * @param {Object} choix objet { necessaire, mesure_audience, reseaux_sociaux }
   */
  function enregistrer(choix) {
    var complet = choixParDefaut();
    CATEGORIES.forEach(function (cat) {
      complet[cat.id] = cat.obligatoire ? true : choix[cat.id] === true;
    });

    var enregistrement = {
      version: VERSION,
      date: new Date().toISOString(),
      choix: complet
    };

    ecrireStockage(JSON.stringify(enregistrement));

    masquerBandeau();
    fermerModale();

    // Signal pour tout script qui voudrait s'y brancher plus tard
    // (mesure d'audience, chargement d'un contenu tiers, etc.).
    document.dispatchEvent(new CustomEvent('aesm:consent', { detail: complet }));
  }

  /* ==========================================================================
     4. Construction du bandeau
     ========================================================================== */

  function construireBandeau() {
    if (document.getElementById(ID_BANDEAU)) return document.getElementById(ID_BANDEAU);

    var el = creer('div', {
      id: ID_BANDEAU,
      class: 'cookie-banner',
      role: 'region',
      'aria-label': 'Gestion des cookies et traceurs'
    });

    el.innerHTML =
      '<h2>Vos préférences de confidentialité</h2>' +
      '<p>Ce site n’utilise aucun traceur publicitaire et aucune mesure ' +
      'd’audience. Seul un fichier technique conserve, pendant six mois, la ' +
      'réponse que vous donnez ici. Vous pouvez accepter, refuser ou choisir ' +
      'en détail, et changer d’avis à tout moment depuis le pied de page. ' +
      '<a href="' + lienPolitiqueCookies() + '">En savoir plus sur les traceurs</a>.</p>' +
      '<div class="cookie-banner__actions">' +
      '<button type="button" class="btn btn--primary" data-consent-action="accepter">Tout accepter</button>' +
      '<button type="button" class="btn btn--primary" data-consent-action="refuser">Tout refuser</button>' +
      '<button type="button" class="btn btn--ghost" data-consent-action="personnaliser">Personnaliser</button>' +
      '</div>';

    document.body.appendChild(el);
    return el;
  }

  function afficherBandeau() {
    bandeau = construireBandeau();
    bandeau.hidden = false;
    // Sur l'image suivante, pour que la transition CSS se déclenche.
    window.requestAnimationFrame(function () {
      bandeau.classList.add('is-visible');
    });
  }

  function masquerBandeau() {
    if (!bandeau) return;
    bandeau.classList.remove('is-visible');
    // `visibility: hidden` est déjà géré en CSS ; on retire le bandeau du
    // parcours d'accessibilité une fois la transition terminée.
    window.setTimeout(function () {
      if (bandeau && !bandeau.classList.contains('is-visible')) bandeau.hidden = true;
    }, 350);
  }

  /* ==========================================================================
     5. Construction de la modale de préférences
     ========================================================================== */

  function construireModale() {
    if (modale) return modale;

    modale = creer('div', {
      id: ID_MODALE,
      class: 'cookie-modal',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': ID_TITRE_MODALE
    });

    panneau = creer('div', { class: 'cookie-modal__panel' });

    var entete =
      '<h2 id="' + ID_TITRE_MODALE + '">Préférences de confidentialité</h2>' +
      '<p style="margin-top:.5rem;color:var(--ink-500);font-size:.95rem">' +
      'Choisissez catégorie par catégorie. Votre décision est conservée six ' +
      'mois, puis la question vous sera reposée. Le détail figure dans notre ' +
      '<a href="' + lienPolitiqueCookies() + '">politique de cookies</a>.</p>';

    var blocs = CATEGORIES.map(function (cat) {
      var attributs =
        'type="checkbox" data-consent-categorie="' + cat.id + '"' +
        (cat.obligatoire ? ' checked disabled' : '') +
        ' aria-describedby="aesm-cookie-desc-' + cat.id + '"';

      return (
        '<div class="cookie-choice">' +
          '<div>' +
            '<h3 id="aesm-cookie-titre-' + cat.id + '">' + cat.titre + '</h3>' +
            '<p id="aesm-cookie-desc-' + cat.id + '">' + cat.texte + '</p>' +
          '</div>' +
          '<label class="switch">' +
            '<input ' + attributs + '>' +
            '<span class="switch__track"></span>' +
            '<span class="visually-hidden">' + cat.titre + '</span>' +
          '</label>' +
        '</div>'
      );
    }).join('');

    var pied =
      '<div class="cookie-banner__actions">' +
      '<button type="button" class="btn btn--primary" data-consent-action="accepter">Tout accepter</button>' +
      '<button type="button" class="btn btn--primary" data-consent-action="refuser">Tout refuser</button>' +
      '<button type="button" class="btn btn--ghost" data-consent-action="enregistrer">Enregistrer mes choix</button>' +
      '</div>' +
      '<div class="btn-row" style="margin-top:var(--sp-3)">' +
      '<button type="button" class="btn btn--ghost btn--sm" data-consent-action="fermer">Fermer sans enregistrer</button>' +
      '</div>';

    panneau.innerHTML = entete + blocs + pied;
    modale.appendChild(panneau);
    document.body.appendChild(modale);

    // Un clic sur le fond sombre ferme la modale, sans rien enregistrer.
    modale.addEventListener('mousedown', function (evt) {
      if (evt.target === modale) fermerModale();
    });

    return modale;
  }

  /** Recopie l'état enregistré (ou les valeurs par défaut) dans les interrupteurs. */
  function synchroniserInterrupteurs() {
    var enregistrement = lireEnregistrement();
    var choix = enregistrement ? enregistrement.choix : choixParDefaut();

    CATEGORIES.forEach(function (cat) {
      var champ = panneau.querySelector('[data-consent-categorie="' + cat.id + '"]');
      if (champ) champ.checked = cat.obligatoire ? true : choix[cat.id] === true;
    });
  }

  /** Lit l'état courant des interrupteurs de la modale. */
  function lireInterrupteurs() {
    var choix = {};
    CATEGORIES.forEach(function (cat) {
      var champ = panneau.querySelector('[data-consent-categorie="' + cat.id + '"]');
      choix[cat.id] = cat.obligatoire ? true : !!(champ && champ.checked);
    });
    return choix;
  }

  /* ==========================================================================
     6. Ouverture, fermeture et piège à focus
     ========================================================================== */

  var SELECTEUR_FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
    'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function elementsFocusables() {
    return Array.prototype.filter.call(
      panneau.querySelectorAll(SELECTEUR_FOCUSABLE),
      function (el) {
        return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement;
      }
    );
  }

  /** Maintient le focus à l'intérieur de la modale (Tab et Maj+Tab). */
  function piegerFocus(evt) {
    if (evt.key !== 'Tab') return;

    var focusables = elementsFocusables();
    if (!focusables.length) {
      evt.preventDefault();
      return;
    }

    var premier = focusables[0];
    var dernier = focusables[focusables.length - 1];

    if (evt.shiftKey && document.activeElement === premier) {
      evt.preventDefault();
      dernier.focus();
    } else if (!evt.shiftKey && document.activeElement === dernier) {
      evt.preventDefault();
      premier.focus();
    }
  }

  /** Gère les touches pendant que la modale est ouverte. */
  function surToucheModale(evt) {
    if (evt.key === 'Escape' || evt.key === 'Esc') {
      evt.preventDefault();
      fermerModale();
      return;
    }
    piegerFocus(evt);
  }

  /**
   * Ouvre la modale de préférences.
   * @param {Element} [declencheur] élément à qui rendre le focus à la fermeture.
   */
  function ouvrirModale(declencheur) {
    construireModale();
    synchroniserInterrupteurs();

    elementDeclencheur =
      declencheur && typeof declencheur.focus === 'function'
        ? declencheur
        : (document.activeElement instanceof HTMLElement ? document.activeElement : null);

    modale.classList.add('is-open');
    document.addEventListener('keydown', surToucheModale, true);

    // Focus sur le premier élément interactif du panneau.
    var focusables = elementsFocusables();
    if (focusables.length) {
      focusables[0].focus();
    } else {
      panneau.setAttribute('tabindex', '-1');
      panneau.focus();
    }
  }

  /** Ferme la modale sans rien enregistrer et rend le focus au déclencheur. */
  function fermerModale() {
    if (!modale || !modale.classList.contains('is-open')) return;

    modale.classList.remove('is-open');
    document.removeEventListener('keydown', surToucheModale, true);

    if (elementDeclencheur && document.contains(elementDeclencheur)) {
      elementDeclencheur.focus();
    }
    elementDeclencheur = null;
  }

  /* ==========================================================================
     7. Écoute des clics (délégation)
     ========================================================================== */

  /**
   * Un seul écouteur posé sur `document` : il fonctionne aussi pour les
   * éléments [data-cookie-settings] ajoutés après le chargement de la page.
   */
  function surClic(evt) {
    var cible = evt.target;
    if (!(cible instanceof Element)) return;

    // 7.1 — Ouverture des préférences depuis n'importe où dans la page.
    var reglages = cible.closest('[data-cookie-settings]');
    if (reglages) {
      evt.preventDefault();
      ouvrirModale(reglages);
      return;
    }

    // 7.2 — Boutons internes du bandeau et de la modale.
    var bouton = cible.closest('[data-consent-action]');
    if (!bouton) return;

    switch (bouton.getAttribute('data-consent-action')) {
      case 'accepter':
        enregistrer(toutesLesCategories(true));
        break;
      case 'refuser':
        enregistrer(toutesLesCategories(false));
        break;
      case 'personnaliser':
        ouvrirModale(bouton);
        break;
      case 'enregistrer':
        enregistrer(lireInterrupteurs());
        break;
      case 'fermer':
        fermerModale();
        break;
    }
  }

  /** Construit un objet de choix où tout est accepté (true) ou refusé (false). */
  function toutesLesCategories(valeur) {
    var choix = {};
    CATEGORIES.forEach(function (cat) {
      choix[cat.id] = cat.obligatoire ? true : valeur;
    });
    return choix;
  }

  /* ==========================================================================
     8. API publique — window.AESMConsent
     ========================================================================== */

  window.AESMConsent = {
    /** Renvoie l'objet des choix enregistrés, ou `null` si rien de valide. */
    get: function () {
      var enregistrement = lireEnregistrement();
      return enregistrement ? enregistrement.choix : null;
    },

    /** Renvoie l'enregistrement complet { version, date, choix } ou `null`. */
    getEnregistrement: function () {
      return lireEnregistrement();
    },

    /** true si la catégorie demandée a été acceptée. */
    has: function (categorie) {
      var choix = this.get();
      return !!(choix && choix[categorie] === true);
    },

    /** Ouvre la modale de préférences. */
    open: function () {
      ouvrirModale(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    },

    /** Ferme la modale sans enregistrer. */
    close: function () {
      fermerModale();
    },

    /** Enregistre un choix { mesure_audience: bool, reseaux_sociaux: bool }. */
    set: function (choix) {
      enregistrer(choix || {});
    },

    /** Efface le choix enregistré et réaffiche le bandeau. */
    reset: function () {
      effacerStockage();
      fermerModale();
      afficherBandeau();
      document.dispatchEvent(new CustomEvent('aesm:consent', { detail: null }));
    },

    /** Liste des catégories, pour information. */
    categories: CATEGORIES.map(function (cat) {
      return { id: cat.id, titre: cat.titre, obligatoire: cat.obligatoire };
    }),

    /** Durée de conservation du choix, en mois. */
    dureeMois: DUREE_VALIDITE_MOIS
  };

  /* ==========================================================================
     9. Démarrage
     ========================================================================== */

  function demarrer() {
    document.addEventListener('click', surClic);

    // Le bandeau n'apparaît que si aucun choix valide n'est enregistré
    // (jamais répondu, format obsolète, ou choix vieux de plus de six mois).
    if (!lireEnregistrement()) afficherBandeau();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
})();
