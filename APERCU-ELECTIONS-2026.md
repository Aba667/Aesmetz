# Élections AESM — publication du 25 octobre 2026

Site : GitHub Pages, branche main. Article mis en avant en haut de l’accueil et en premier dans les actualités.

Sondage : Worker Cloudflare `aesm-sondage-2026`, stockage persistant SQLite dans le Durable Object ElectionPoll. Code et configuration dans `_worker/`. Le chemin `/` utilise le compteur public ; `/preview` utilise un compteur de test distinct, accessible uniquement depuis l’aperçu localhost:8876. Les tests ne modifient pas les résultats publics.

Une participation par identifiant aléatoire dans le stockage local du navigateur. Pas de vérification d’identité ; changer de navigateur ou effacer le stockage permet de participer à nouveau. Le serveur conserve uniquement une empreinte et le choix. Politique de confidentialité et politique de cookies actualisées.

La version PHP dans api/ reste un ancien prototype local et n’est pas nécessaire à la publication GitHub Pages.

Déployer le compteur : `npx wrangler deploy --config _worker/wrangler.jsonc`.
