<?php
/**
 * Plugin Name: iwebCreative Security Agent
 * Description: Agent de surveillance centralisé SecOps (Lecture Seule).
 * Version: 1.0.0
 * Author: Hamza Bourras
 */

// 1. Sécurité absolue : empêcher l'accès direct au fichier
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// 2. Définition de la clé secrète (À modifier par la suite pour la production)
define( 'IWEB_AGENT_SECRET_TOKEN', 'IWEB_SECURE_TOKEN_2026_XYZ' );

// 3. Enregistrement de la route API REST personnalisée
add_action( 'rest_api_init', function () {
    register_rest_route( 'iwebcreative/v1', '/health', [
        'methods'             => 'GET',
        'callback'            => 'iweb_get_health_data',
        'permission_callback' => 'iweb_verify_bearer_token',
    ] );
} );

/**
 * 4. Vérification du jeton de sécurité (Bearer Token)
 */
function iweb_verify_bearer_token( WP_REST_Request $request ) {
    $auth_header = $request->get_header( 'authorization' );
    $expected_header = 'Bearer ' . IWEB_AGENT_SECRET_TOKEN;

    // Si le token correspond, on autorise l'accès
    if ( $auth_header === $expected_header ) {
        return true;
    }

    // Sinon, on renvoie une erreur 401 Non Autorisé
    return new WP_Error(
        'rest_forbidden',
        'Accès refusé : Jeton de sécurité invalide ou manquant.',
        [ 'status' => 401 ]
    );
}


/**
 * 5. Collecte et formatage des données du site
 */
function iweb_get_health_data() {
    // Inclusion requise dans WordPress pour utiliser la fonction get_plugins()
    if ( ! function_exists( 'get_plugins' ) ) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }

    // Récupération de tous les plugins installés et de la liste de ceux qui sont actifs
    $all_plugins = get_plugins();
    $active_plugins_list = get_option( 'active_plugins', [] );

    // Récupération des données du dernier login admin
    $last_admin_time = get_option( 'iweb_last_admin_login_time', null );
    $last_admin_ip = get_option( 'iweb_last_admin_login_ip', null );
    
    $formatted_plugins = [];

    // Boucle pour déterminer le statut de chaque plugin
    foreach ( $all_plugins as $plugin_path => $plugin_data ) {
        $is_active = in_array( $plugin_path, $active_plugins_list, true );
        
        $formatted_plugins[] = [
            'name'    => $plugin_data['Name'],
            'version' => $plugin_data['Version'],
            'status'  => $is_active ? 'active' : 'inactive',
            'path'    => $plugin_path

        ];
    }

    // NOUVEAU : Récupérer les alertes de sécurité stockées par le Logger
    $security_events = get_transient( 'iweb_security_logs' ) ?: [];
    
    // (Optionnel) Effacer les logs après les avoir lus pour ne pas les renvoyer en double la prochaine fois
    // delete_transient( 'iweb_security_logs' );

    // Construction et renvoi de la réponse au format JSON
    return rest_ensure_response( [
        'timestamp'       => current_time( 'mysql' ),
        'site_url'        => get_site_url(),
        'core'            => [
            'wp_version'  => get_bloginfo( 'version' ),
            'php_version' => phpversion(),
        ],
        'plugins'         => $formatted_plugins,
        'security_events' => $security_events, // <-- Les événements sont maintenant envoyés au Dashboard !
        // ✨ NOUVEAU : On ajoute les données d'audit
        'last_admin_login'=> $last_admin_time,
        'last_admin_ip'   => $last_admin_ip
    ] );
}


/**
 * 6. Moteur de journalisation centralisé & Transmission (Push Model)
 */
function iweb_log_security_event( $event_type, $severity, $message ) {
    // On sécurise la récupération de l'IP
    $ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field($_SERVER['REMOTE_ADDR']) : 'IP_Inconnue';
    $time = current_time( 'mysql' );

    // --- 1. SAUVEGARDE LOCALE (Optionnelle, utile pour le debug sur place) ---
    $logs = get_transient( 'iweb_security_logs' ) ?: [];
    $event_data = [
        'event_type' => $event_type,
        'severity'   => $severity,
        'message'    => $message,
        'ip_address' => $ip,
        'time'       => $time
    ];
    $logs[] = $event_data;
    if ( count( $logs ) > 50 ) { array_shift( $logs ); }
    set_transient( 'iweb_security_logs', $logs, DAY_IN_SECONDS );


    // --- 2. TRANSMISSION TEMPS RÉEL AU SOC FASTAPI ---
    
    // ⚠️ ATTENTION RÉSEAU DOCKER : 
    // Si WP est dans un conteneur et FastAPI dans un autre, localhost ne marchera pas.
    // Utilise le nom du service Docker (ex: http://backend:8000/api/alerts) 
    // ou l'IP de ta machine hôte (http://host.docker.internal:8000/api/alerts).
    $api_url = 'https://candy-amenity-tricking.ngrok-free.dev/api/alerts'; 

    $payload = wp_json_encode([
        'security_events' => [
            [
                'event_type' => $event_type,
                'severity'   => $severity,
                'message'    => $message,
                'ip_address' => $ip
            ]
        ]
    ]);

    // Envoi de la requête HTTP
    wp_remote_post( $api_url, [
        'method'      => 'POST',
        'timeout'     => 3, // Timeout court pour ne pas bloquer l'affichage du site client
        'redirection' => 0,
        'blocking'    => false, // IMPORTANT : Exécution asynchrone ("Fire and forget")
        'headers'     => [
            'Content-Type'  => 'application/json',
            'Authorization' => 'Bearer ' . IWEB_AGENT_SECRET_TOKEN
        ],
        'body'        => $payload,
    ]);
}


/**
 * 7. Détection d'Attaques (Hooks de surveillance active)
 */

// A. Brute Force : Échecs de connexion
add_action( 'wp_login_failed', function( $username ) {
    iweb_log_security_event( 'failed_login', 'high', "Echec de connexion wp-admin pour : {$username}" );
} );

// B. Backdoor : Création ou modification d'un compte avec droits d'Administrateur
add_action( 'set_user_role', function( $user_id, $role, $old_roles ) {
    if ( $role === 'administrator' ) {
        $user = get_userdata( $user_id );
        iweb_log_security_event( 'admin_privilege_granted', 'critical', "Droits d'administrateur accordes a l'utilisateur : {$user->user_login}" );
    }
}, 10, 3 );

// C. Sabotage : Désactivation d'un plugin (ex: un pirate désactive Wordfence)
add_action( 'deactivated_plugin', function( $plugin, $network_activation ) {
    iweb_log_security_event( 'plugin_deactivated', 'medium', "Extension desactivee : {$plugin}" );
}, 10, 2 );

// D. Détournement : Modification de l'email d'administration global
add_action( 'update_option_admin_email', function( $old_value, $value ) {
    iweb_log_security_event( 'admin_email_changed', 'critical', "L'email d'administration global a ete change de {$old_value} a {$value}" );
}, 10, 2 );

// E. Altération : Changement du thème actif
add_action( 'switch_theme', function( $new_name, $new_theme ) {
    iweb_log_security_event( 'theme_switched', 'high', "Le theme du site a ete remplace par : {$new_name}" );
}, 10, 2 );

// F. Attaque ciblée : Réinitialisation de mot de passe réussie
add_action( 'after_password_reset', function( $user, $new_pass ) {
    iweb_log_security_event( 'password_reset', 'medium', "Le mot de passe de l'utilisateur {$user->user_login} a ete reinitialise." );
}, 10, 2 );



// ========================================================================
// 8. Détection Avancée (Mini-WAF & IDS Couche 7)
// ========================================================================

/**
 * G. Détection de Scanners de Vulnérabilités (Nmap, WPScan, SQLMap)
 * Analyse le User-Agent pour repérer les outils automatisés agressifs.
 */
add_action( 'init', function() {
    $user_agent = isset( $_SERVER['HTTP_USER_AGENT'] ) ? $_SERVER['HTTP_USER_AGENT'] : '';
    // Expression régulière contenant les signatures des scanners les plus connus
    $bad_agents_regex = '/(?:nmap|sqlmap|nikto|wpscan|dirbuster|acunetix|masscan|hydra)/i';

    if ( preg_match( $bad_agents_regex, $user_agent ) ) {
        iweb_log_security_event( 'scanner_detected', 'high', "Scanner automatise detecte via User-Agent : " . sanitize_text_field($user_agent) );
    }
});

/**
 * H. Détection des Injections SQL (SQLi) et XSS (Cross-Site Scripting)
 * Inspecte l'URL demandée pour trouver des "Payloads" malveillants.
 */
add_action( 'init', function() {
    $request_uri  = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
    $query_string = isset($_SERVER['QUERY_STRING']) ? $_SERVER['QUERY_STRING'] : '';

    // Signatures d'attaques classiques (SQLi, XSS, Path Traversal LFI)
    $bad_patterns = [
        '/(?:union\s+all\s+select|concat\s*\(|information_schema|waitfor\s+delay)/i', // SQL Injection
        '/(?:<script>|javascript:|onerror=|onload=)/i',                               // XSS
        '/(?:\.\.\/|\.\.\\\\|\/etc\/passwd)/i'                                        // Path Traversal / LFI
    ];

    foreach ( $bad_patterns as $pattern ) {
        if ( preg_match( $pattern, $request_uri ) || preg_match( $pattern, $query_string ) ) {
            iweb_log_security_event( 'waf_alert_sqli_xss', 'critical', "Tentative d'attaque Web (SQLi/XSS/LFI) detectee sur l'URI : " . sanitize_text_field($request_uri) );
            
            // Note DevSecOps : Actuellement on fait de l'IDS (Détection). 
            // Si on décommente wp_die(), on devient un IPS (Prévention) !
            // wp_die('iweb FleetGuard : Requête bloquée par sécurité.', 'Accès Refusé', ['response' => 403]);
            break; 
        }
    }
});

/**
 * I. Détection de tentative d'Upload de Web Shell (Fichiers malveillants)
 * Écoute le processus d'upload de WordPress avant que le fichier ne soit enregistré.
 */
add_filter( 'wp_handle_upload_prefilter', function( $file ) {
    $filename = strtolower( $file['name'] );
    // WP bloque le PHP par défaut, mais les attaquants tentent des extensions doubles ou alternatives
    if ( preg_match( '/\.(php|phtml|php5|shtml|exe|sh|pl|cgi|py)$/', $filename ) ) {
        iweb_log_security_event( 'malicious_upload_attempt', 'critical', "Tentative d'upload d'un fichier potentiellement executable (WebShell) : {$filename}" );
    }
    return $file;
});

/**
 * J. Utilisation de l'Éditeur de Fichiers interne de WordPress
 * Les attaquants l'utilisent souvent après une compromission admin pour injecter du code dans le thème.
 */
add_action( 'load-theme-editor.php', function() {
    iweb_log_security_event( 'file_editor_accessed', 'critical', "L'editeur de code interne WordPress a ete ouvert." );
});
add_action( 'load-plugin-editor.php', function() {
    iweb_log_security_event( 'file_editor_accessed', 'critical', "L'editeur de plugins interne WordPress a ete ouvert." );
});


// K. Suivi d'Audit : Enregistrement du dernier login administrateur réussi
add_action( 'wp_login', function( $user_login, $user ) {
    // On vérifie si l'utilisateur qui vient de se connecter a le rôle d'administrateur
    if ( in_array( 'administrator', (array) $user->roles ) ) {
        $ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field($_SERVER['REMOTE_ADDR']) : 'IP_Inconnue';
        
        // On sauvegarde l'heure et l'IP dans la base de données de WordPress (table wp_options)
        update_option( 'iweb_last_admin_login_time', current_time( 'mysql' ) );
        update_option( 'iweb_last_admin_login_ip', $ip );
    }
}, 10, 2 );