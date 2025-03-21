<?php
// send_email.php

// Vérifier que la requête est en POST
if ($_SERVER["REQUEST_METHOD"] == "POST") {

    // Récupération et assainissement des données
    $region = isset($_POST["region"]) ? strip_tags(trim($_POST["region"])) : "Inconnue";
    $nom     = isset($_POST["nom"]) ? strip_tags(trim($_POST["nom"])) : "";
    $prenom  = isset($_POST["prenom"]) ? strip_tags(trim($_POST["prenom"])) : "";
    $email   = isset($_POST["email"]) ? filter_var(trim($_POST["email"]), FILTER_SANITIZE_EMAIL) : "";
    $objet   = isset($_POST["objet"]) ? strip_tags(trim($_POST["objet"])) : "Nouveau contact";
    $message = isset($_POST["message"]) ? strip_tags(trim($_POST["message"])) : "";

    // Pour le formulaire Afrique, quelques champs supplémentaires
    $date_naissance   = isset($_POST["date_naissance"]) ? strip_tags(trim($_POST["date_naissance"])) : "";
    $lieu_naissance   = isset($_POST["lieu_naissance"]) ? strip_tags(trim($_POST["lieu_naissance"])) : "";
    $region_naissance = isset($_POST["region_naissance"]) ? strip_tags(trim($_POST["region_naissance"])) : "";
    $telephone        = isset($_POST["telephone"]) ? strip_tags(trim($_POST["telephone"])) : "";
    $acceptation      = isset($_POST["acceptation"]) ? strip_tags(trim($_POST["acceptation"])) : "";
    $agence           = isset($_POST["agence"]) ? strip_tags(trim($_POST["agence"])) : "";
    $agence_nom       = isset($_POST["agence_nom"]) ? strip_tags(trim($_POST["agence_nom"])) : "";
    $garant           = isset($_POST["garant"]) ? strip_tags(trim($_POST["garant"])) : "";
    $hebergeur        = isset($_POST["hebergeur"]) ? strip_tags(trim($_POST["hebergeur"])) : "";

    // Vérification de la validité de l'e-mail
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo "L'adresse e-mail n'est pas valide.";
        exit;
    }

    // Construction du contenu de l'e-mail (texte)
    $email_body  = "Vous avez reçu un nouveau message du formulaire de contact ($region).\n\n";
    $email_body .= "Nom : $nom\n";
    $email_body .= "Prénom : $prenom\n";
    $email_body .= "Email : $email\n";
    $email_body .= "Objet : $objet\n\n";
    $email_body .= "Message :\n$message\n\n";

    if ($region === "Afrique") {
        $email_body .= "Date de naissance : $date_naissance\n";
        $email_body .= "Lieu de naissance : $lieu_naissance\n";
        $email_body .= "Région de naissance : $region_naissance\n";
        $email_body .= "Téléphone : $telephone\n";
        $email_body .= "Acceptation : $acceptation\n";
        $email_body .= "Passé par une agence : $agence\n";
        if ($agence === "oui") {
            $email_body .= "Nom de l'agence : $agence_nom\n";
        }
        $email_body .= "Garant : $garant\n";
        $email_body .= "Hébergeur : $hebergeur\n";
    }

    // Génération du PDF avec FPDF
    require_once('fpdf/fpdf.php');

    // Création d'un nouveau document PDF
    $pdf = new FPDF();
    $pdf->AddPage();
    $pdf->SetFont('Arial','B',16);
    $pdf->Cell(0,10,"Résumé du formulaire ($region)",0,1);
    $pdf->Ln(5);
    $pdf->SetFont('Arial','',12);
    
    // Ajout des informations dans le PDF
    $pdf->Cell(40,10,"Nom : $nom",0,1);
    $pdf->Cell(40,10,"Prénom : $prenom",0,1);
    $pdf->Cell(40,10,"Email : $email",0,1);
    $pdf->Cell(40,10,"Objet : $objet",0,1);
    $pdf->MultiCell(0,10,"Message : $message",0,1);
    
    if ($region === "Afrique") {
        $pdf->Cell(40,10,"Date de naissance : $date_naissance",0,1);
        $pdf->Cell(40,10,"Lieu de naissance : $lieu_naissance",0,1);
        $pdf->Cell(40,10,"Région de naissance : $region_naissance",0,1);
        $pdf->Cell(40,10,"Téléphone : $telephone",0,1);
        $pdf->Cell(40,10,"Acceptation : $acceptation",0,1);
        $pdf->Cell(40,10,"Agence : $agence",0,1);
        if ($agence === "oui") {
            $pdf->Cell(40,10,"Nom de l'agence : $agence_nom",0,1);
        }
        $pdf->Cell(40,10,"Garant : $garant",0,1);
        $pdf->Cell(40,10,"Hébergeur : $hebergeur",0,1);
    }

    // Récupération du PDF en tant que chaîne
    $pdfContent = $pdf->Output('S');
    $pdfEncoded = chunk_split(base64_encode($pdfContent));

    // Préparation de l'e-mail multipart/mixed avec pièce jointe
    $to = "aesmetz221@gmail.com, aesmetz.etu@gmail.com";
    $subject = "Nouveau contact: $objet";
    $from = $email; // On peut utiliser l'adresse de l'expéditeur

    $separator = md5(time());
    $eol = "\r\n";

    // En-têtes
    $headers = "From: $from".$eol;
    $headers .= "Reply-To: $from".$eol;
    $headers .= "MIME-Version: 1.0".$eol;
    $headers .= "Content-Type: multipart/mixed; boundary=\"".$separator."\"".$eol.$eol;

    // Corps du message
    $body = "--".$separator.$eol;
    $body .= "Content-Type: text/plain; charset=\"UTF-8\"".$eol;
    $body .= "Content-Transfer-Encoding: 7bit".$eol.$eol;
    $body .= $email_body.$eol;
    
    // Ajout de la pièce jointe PDF
    $filename = "formulaire.pdf";
    $body .= "--".$separator.$eol;
    $body .= "Content-Type: application/pdf; name=\"".$filename."\"".$eol; 
    $body .= "Content-Transfer-Encoding: base64".$eol;
    $body .= "Content-Disposition: attachment; filename=\"".$filename."\"".$eol.$eol;
    $body .= $pdfEncoded.$eol;
    $body .= "--".$separator."--";

    // Envoi de l'e-mail
    if (mail($to, $subject, $body, $headers)) {
        header("Location: merci.html");
        exit;
    } else {
        echo "Une erreur est survenue lors de l'envoi de l'e-mail.";
    }
} else {
    echo "Méthode de requête non autorisée.";
}
?>
