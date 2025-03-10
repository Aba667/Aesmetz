<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Récupérer les données du formulaire
    $name = htmlspecialchars($_POST['name']);
    $email = htmlspecialchars($_POST['email']);
    $message = htmlspecialchars($_POST['message']);

    // Destinataire
    $to = "aesmetz.etu@gmail.com";

    // Sujet de l'e-mail
    $subject = "Nouveau message de $name";

    // Corps de l'e-mail
    $body = "Nom : $name\n";
    $body .= "Email : $email\n\n";
    $body .= "Message :\n$message";

    // En-têtes de l'e-mail
    $headers = "From: $email";

    // Envoyer l'e-mail
    if (mail($to, $subject, $body, $headers)) {
        echo "Message envoyé avec succès !";
    } else {
        echo "Erreur lors de l'envoi du message.";
    }
}
?>