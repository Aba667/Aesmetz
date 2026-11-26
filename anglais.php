<?php
declare(strict_types=1);

$appPath = getenv('AESM_ETUDES_APP_PATH') ?: dirname(__DIR__) . '/etudes-app';
require $appPath . '/app/bootstrap.php';

const ENGLISH_REGISTRATION_URL = 'https://aesmetz.com/anglais.php';

const CAN_DO = [
    'intro' => 'Je peux me présenter et parler de mes études.',
    'questions' => 'Je peux poser des questions simples et comprendre les réponses.',
    'follow' => 'Je peux suivre une conversation quand on parle lentement.',
    'opinion' => 'Je peux donner mon avis et le justifier.',
    'debate' => 'Je peux participer à un débat sans préparer mes phrases.',
    'present' => 'Je peux passer un entretien ou faire une présentation en anglais.',
];
const GOALS = [
    'oser' => 'Oser parler',
    'entretien' => 'Préparer un stage ou un entretien',
    'etudes' => 'Suivre des cours ou lire en anglais',
    'mobilite' => 'Partir à l’étranger',
    'test' => 'Préparer un test (TOEIC, IELTS…)',
    'autre' => 'Autre objectif',
];
const SLOTS = [
    'lun-soir' => 'Lundi soir', 'mar-soir' => 'Mardi soir', 'mer-am' => 'Mercredi après-midi',
    'mer-soir' => 'Mercredi soir', 'jeu-soir' => 'Jeudi soir', 'ven-soir' => 'Vendredi soir',
    'sam-matin' => 'Samedi matin', 'sam-am' => 'Samedi après-midi',
];
function posted(string $key): string {
    return is_string($_POST[$key] ?? null) ? trim($_POST[$key]) : '';
}

function posted_choices(string $key, array $options): array {
    $values = $_POST[$key] ?? [];
    if (!is_array($values)) return [];
    return array_values(array_intersect(array_keys($options), array_filter($values, 'is_string')));
}

function checkboxes(string $legend, string $name, array $options, array $checked, string $help = '', string $class = 'choices'): void {
    echo '<fieldset class="' . e($class) . '"><legend>' . e($legend) . '</legend>' . ($help ? '<p class="field-help">' . e($help) . '</p>' : '');
    foreach ($options as $k => $v) {
        echo '<label class="check"><input type="checkbox" name="' . e($name) . '[]" value="' . e($k) . '"' . (in_array((string)$k, $checked, true) ? ' checked' : '') . '><span>' . e($v) . '</span></label>';
    }
    echo '</fieldset>';
}

function submit_english_registration(): void {
    $first = posted('first_name');
    $last = posted('last_name');
    if ($first === '' || $last === '' || mb_strlen($first) > 60 || mb_strlen($last) > 60
        || !mb_check_encoding($first . $last, 'UTF-8') || preg_match('/[\r\n]/', $first . $last)) {
        throw new InvalidArgumentException('Vérifiez votre prénom et votre nom.');
    }

    $email = strtolower(posted('email'));
    if (strlen($email) > 190 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Indiquez une adresse e-mail valide.');
    }
    $whatsapp = preg_replace('/[\s.\-()]/', '', posted('whatsapp'));
    if ($whatsapp !== '' && !preg_match('/^\+?\d{8,15}$/D', $whatsapp)) {
        throw new InvalidArgumentException('Le numéro WhatsApp doit contenir 8 à 15 chiffres, indicatif compris.');
    }
    $slots = posted_choices('availability', SLOTS);
    if (!$slots) throw new InvalidArgumentException('Cochez au moins un créneau où vous êtes disponible.');
    $goal = posted('goal');
    if (!isset(GOALS[$goal])) throw new InvalidArgumentException('Choisissez votre objectif principal.');
    $detail = posted('goal_detail');
    if (mb_strlen($detail) > 300 || !mb_check_encoding($detail, 'UTF-8')) {
        throw new InvalidArgumentException('Décrivez votre objectif en 300 caractères maximum.');
    }
    $canDo = posted_choices('can_do', CAN_DO);
    $body = implode("\n", [
        "$first $last souhaite participer aux rencontres d’anglais.",
        "Adresse e-mail : $email",
        'WhatsApp : ' . ($whatsapp ?: 'Non renseigné'),
        'Disponibilités : ' . implode(', ', array_map(fn($slot) => SLOTS[$slot], $slots)),
        'Objectif : ' . GOALS[$goal],
        'Précision : ' . ($detail ?: 'Non renseignée'),
        'Auto-évaluation : ' . ($canDo ? implode(' ', array_map(fn($item) => CAN_DO[$item], $canDo)) : 'Non renseignée'),
    ]);

    // La file existante gère l’envoi, les tentatives suivantes et les doublons.
    $event = 'english-registration:' . hash('sha256', $email);
    queue_mail('english_registration', $event, ['email' => english_registration_recipient()],
        'Nouvelle inscription aux rencontres d’anglais', $body, 'Voir le formulaire', ENGLISH_REGISTRATION_URL);
}

header('Cache-Control: private, no-store');
header('Content-Type: text/html; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
$method = $_SERVER['REQUEST_METHOD'];
if (!in_array($method, ['GET', 'HEAD', 'POST'], true)) {
    header('Allow: GET, HEAD, POST');
    http_response_code(405);
    exit;
}

ini_set('session.use_strict_mode', '1');
session_name('aesm_anglais_inscription');
session_set_cookie_params(['path' => '/anglais.php', 'secure' => cfg('env') === 'production',
    'httponly' => true, 'samesite' => 'Lax']);
session_start();

$error = null;
$sent = !empty($_SESSION['registration_sent']) && ($_GET['inscription'] ?? null) === 'recue';
$open = cfg('english_registration_open') ?? true;
if ($method === 'POST') {
    try {
        if (!hash_equals(csrf(), posted('csrf'))) {
            fail(403, 'Rechargez le formulaire avant de le renvoyer.');
        }
        if (!$open) fail(403, 'Les inscriptions sont fermées.');
        if (posted('website') !== '') fail(422, 'Rechargez le formulaire et réessayez.');
        rate_limit('english-registration', 30, 3600);
        submit_english_registration();
        $_SESSION['registration_sent'] = true;
        unset($_SESSION['csrf']);
        header('Location: /anglais.php?inscription=recue#formulaire', true, 303);
        if (cfg('mail_on_request')) mail_after_response();
        exit;
    } catch (InvalidArgumentException $exception) {
        http_response_code(422);
        $error = $exception->getMessage();
    } catch (HttpError $exception) {
        $error = $exception->getMessage();
    } catch (Throwable $exception) {
        http_response_code(503);
        error_log('AESM anglais : formulaire indisponible (' . $exception::class . ')');
        $error = 'L’envoi est momentanément indisponible. Réessayez dans quelques instants.';
    }
}
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0f4d2e">
  <title>Inscription aux rencontres d’anglais | AESM</title>
  <meta name="description" content="Inscrivez-vous aux rencontres gratuites de l’AESM pour pratiquer l’anglais entre étudiants à Metz. Tous les niveaux sont bienvenus.">
  <link rel="canonical" href="<?= e(ENGLISH_REGISTRATION_URL) ?>">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Les rencontres d’anglais de l’AESM">
  <meta property="og:description" content="Des rencontres gratuites pour pratiquer l’anglais entre étudiants à Metz. Inscription sans compte.">
  <meta property="og:url" content="<?= e(ENGLISH_REGISTRATION_URL) ?>">
  <meta property="og:image" content="https://aesmetz.com/assets/img/logo/aesm.png">
  <link rel="icon" href="/assets/img/logo/favicon.png" type="image/png">
  <link rel="stylesheet" href="/assets/css/aesm.css">
  <link rel="stylesheet" href="/assets/css/anglais.css?v=1">
  <script src="/assets/js/consent.js?v=20261115" defer></script>
</head>
<body>
<a class="skip-link" href="#contenu">Aller au contenu principal</a>
<header class="site-header">
  <div class="container header-bar">
    <a class="brand" href="/">
      <img src="/assets/img/logo/aesm.webp" alt="" width="48" height="48">
      <span><span class="brand__name">AESM</span><span class="brand__tag">Étudiants Sénégalais de Metz</span></span>
    </a>
  </div>
</header>
<main id="contenu">
  <header class="page-header">
    <div class="container english-width">
      <p class="eyebrow" lang="en">AESM Speaks English Too!</p>
      <h1>On parle anglais à Metz</h1>
      <p class="lead">On se retrouve entre étudiants pour pratiquer l’anglais à l’oral. C’est gratuit et ouvert à tous les niveaux, même si vous débutez.</p>
    </div>
  </header>
  <section class="section english-section" id="formulaire">
    <div class="container english-width">
    <?php if ($sent && !$error): ?>
      <div class="english-card" role="status">
        <h2>Merci pour votre inscription !</h2>
        <p>L’équipe vous contactera pour vous donner les détails des rencontres et vous inviter à rejoindre le groupe WhatsApp.</p>
        <a class="btn btn--primary" href="/">Retour à l’accueil</a>
      </div>
    <?php elseif (!$open): ?>
      <div class="english-card"><h2>Les inscriptions sont fermées</h2><p>Pour toute question, vous pouvez <a href="/contact.html">contacter l’AESM</a>.</p></div>
    <?php else: ?>
      <form class="english-card form" action="/anglais.php#formulaire" method="post">
        <div><h2>Inscription</h2><p>Indiquez vos disponibilités. L’équipe vous recontactera quand le groupe WhatsApp sera prêt. Les champs facultatifs sont indiqués.</p></div>
        <?php if ($error): ?><p class="english-error" role="alert"><?= e($error) ?></p><?php endif ?>
        <?= csrf_field() ?>
        <div hidden><label>Site web <input name="website" type="text" tabindex="-1" autocomplete="off"></label></div>
        <div class="form-grid">
          <label class="field">Prénom <input class="input" name="first_name" type="text" autocomplete="given-name" value="<?= e(posted('first_name')) ?>" maxlength="60" required></label>
          <label class="field">Nom <input class="input" name="last_name" type="text" autocomplete="family-name" value="<?= e(posted('last_name')) ?>" maxlength="60" required></label>
          <label class="field">Adresse e-mail <input class="input" name="email" type="email" autocomplete="email" value="<?= e(posted('email')) ?>" maxlength="190" required></label>
          <label class="field">Numéro WhatsApp (facultatif)
            <input class="input" name="whatsapp" type="tel" autocomplete="tel" value="<?= e(posted('whatsapp')) ?>" maxlength="30" aria-describedby="whatsapp-aide">
            <span class="hint" id="whatsapp-aide">Avec l’indicatif du pays. Vous pouvez aussi être contacté par e-mail.</span>
          </label>
        </div>
        <?php checkboxes('Vos disponibilités', 'availability', SLOTS, posted_choices('availability', SLOTS), 'Cochez tous les créneaux qui vous conviennent.', 'english-choices'); ?>
        <label class="field">Votre objectif principal
          <select class="select" name="goal" required>
            <option value="">Choisir un objectif</option>
            <?php foreach (GOALS as $value => $label): ?>
              <option value="<?= e($value) ?>"<?= posted('goal') === $value ? ' selected' : '' ?>><?= e($label) ?></option>
            <?php endforeach ?>
          </select>
        </label>
        <label class="field">Quelques mots sur votre objectif (facultatif)
          <textarea class="textarea" name="goal_detail" rows="2" maxlength="300"><?= e(posted('goal_detail')) ?></textarea>
        </label>
        <?php checkboxes('En anglais, je peux déjà… (facultatif)', 'can_do', CAN_DO, posted_choices('can_do', CAN_DO), 'Cochez les phrases qui vous correspondent.', 'english-choices english-choices--full'); ?>
        <p class="form-note" id="inscription-confidentialite">Vos réponses sont transmises au responsable des inscriptions pour organiser les groupes et vous envoyer une invitation. <a href="/politique-confidentialite.html#inscriptions-anglais">En savoir plus sur vos données</a>.</p>
        <div><button class="btn btn--primary" type="submit">Envoyer mon inscription</button></div>
      </form>
    <?php endif ?>
    </div>
  </section>
</main>
<footer class="site-footer">
  <div class="container footer-bottom">
    <a href="/">Association des étudiants sénégalais de Metz</a>
    <a href="/politique-confidentialite.html">Confidentialité</a>
    <button type="button" data-cookie-settings>Préférences de cookies</button>
  </div>
</footer>
</body>
</html>
