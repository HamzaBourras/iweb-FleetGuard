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

    // Route 1 : Inventaire rapide
    register_rest_route( 'iwebcreative/v1', '/health', [
        'methods'             => 'GET',
        'callback'            => 'iweb_get_health_data',
        'permission_callback' => 'iweb_verify_bearer_token',
    ] );

    // ROUTE 2 : Scan profond anti-malware (indépendante)
    register_rest_route( 'iwebcreative/v1', '/malware-scan', [
        'methods'             => 'GET',
        'callback'            => 'iweb_run_malware_scan',
        'permission_callback' => 'iweb_verify_bearer_token',
    ] );

    // ROUTE 3 : Suppression de fichier malveillant
    register_rest_route( 'iwebcreative/v1', '/delete-file', [
        'methods'             => 'POST',
        'callback'            => 'iweb_delete_malicious_file',
        'permission_callback' => 'iweb_verify_bearer_token',
    ] );
} );

/**
 * 4. Vérification du jeton de sécurité (Bearer Token)
 */
function iweb_verify_bearer_token( WP_REST_Request $request ) {
    $auth_header = $request->get_header( 'authorization' );
    
    // Vérification de la présence du format "Bearer "
    if ( ! $auth_header || ! preg_match( '/Bearer\s(\S+)/', $auth_header, $matches ) ) {
        return new WP_Error(
            'rest_forbidden',
            'Accès refusé : Jeton manquant ou mal formaté.',
            [ 'status' => 401 ]
        );
    }
    
    $token_recu = $matches[1];

    // On récupère le jeton stocké dynamiquement dans le code source
    $token_local = IWEB_AGENT_SECRET_TOKEN; 

    if ( ! $token_local ) {
        return new WP_Error(
            'rest_forbidden',
            'Agent non configuré : Aucun jeton de sécurité enregistré sur ce site.',
            [ 'status' => 401 ]
        );
    }

    // Comparaison cryptographique sécurisée contre les attaques temporelles
    if ( hash_equals( $token_local, $token_recu ) ) {
        return true;
    }

    return new WP_Error(
        'rest_forbidden',
        'Accès refusé : Accès refusé par la cible : Jeton de sécurité invalide ou révoqué.',
        [ 'status' => 401 ]
    );
}


/**
 * 5. Collecte et formatage des données du site
 */
function iweb_get_health_data() {
    if ( ! function_exists( 'get_plugins' ) ) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }

    $all_plugins = get_plugins();
    $active_plugins_list = get_option( 'active_plugins', [] );

    $last_admin_time = get_option( 'iweb_last_admin_login_time', null );
    $last_admin_ip = get_option( 'iweb_last_admin_login_ip', null );
    
    // ✨ NOUVEAU : On interroge WordPress pour connaître les mises à jour en attente
    wp_update_plugins(); // Force WP à vérifier (optionnel, mais garantit des données fraîches)
    $update_plugins = get_site_transient( 'update_plugins' );
    
    $formatted_plugins = [];

    foreach ( $all_plugins as $plugin_path => $plugin_data ) {
        $is_active = in_array( $plugin_path, $active_plugins_list, true );
        
        // ✨ NOUVEAU : Vérification de la disponibilité d'une mise à jour
        $has_update = isset( $update_plugins->response[ $plugin_path ] );
        $new_version = $has_update ? $update_plugins->response[ $plugin_path ]->new_version : null;
        
        $formatted_plugins[] = [
            'name'        => $plugin_data['Name'],
            'version'     => $plugin_data['Version'],
            'status'      => $is_active ? 'active' : 'inactive',
            'path'        => $plugin_path,
            'has_update'  => $has_update,  // true ou false
            'new_version' => $new_version  // ex: "2.4.1" ou null
        ];
    }

    $security_events = get_transient( 'iweb_security_logs' ) ?: [];
    
    return rest_ensure_response( [
        'timestamp'       => current_time( 'mysql' ),
        'site_url'        => get_site_url(),
        'core'            => [
            'wp_version'  => get_bloginfo( 'version' ),
            'php_version' => phpversion(),
        ],
        'plugins'         => $formatted_plugins,
        'security_events' => $security_events,
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


// ========================================================================
// 9. Scanner Heuristique de Fichiers (Module EDR Indépendant)
// ========================================================================

/**
 * Fonction récursive sécurisée pour explorer les dossiers sans faire crasher PHP
 */
function iweb_safe_scan_directory( $dir, &$results, $depth = 0 ) {
    // Sécurité : on limite la profondeur à 5 sous-dossiers pour éviter les timeouts
    if ( $depth > 5 || ! is_dir( $dir ) ) return;

    // L'arobase (@) ignore silencieusement les dossiers protégés
    $files = @scandir( $dir );
    if ( ! $files ) return;

    foreach ( $files as $file ) {
        if ( $file === '.' || $file === '..' ) continue;
        
        $path = $dir . '/' . $file;

        if ( is_dir( $path ) ) {
            iweb_safe_scan_directory( $path, $results, $depth + 1 );
        } else {
            $ext = strtolower( pathinfo( $path, PATHINFO_EXTENSION ) );
            // On traque les extensions exécutables dans un dossier de médias
            if ( in_array( $ext, ['php', 'phtml', 'php5', 'sh', 'pl', 'py', 'cgi'] ) ) {
                $results[] = [
                    'file'     => str_replace( ABSPATH, '', $path ),
                    'threat'   => 'Web Shell ou script executable potentiel',
                    'severity' => 'critical'
                ];
            }
        }
    }
}

/**
 * Callback de la nouvelle route /malware-scan
 */
function iweb_run_malware_scan() {
    $malicious_files = [];

    // --- Zone Rouge 1 : Le dossier wp-content/uploads ---
    $upload_dir = wp_upload_dir();
    $upload_path = $upload_dir['basedir'];

    if ( is_dir( $upload_path ) ) {
        iweb_safe_scan_directory( $upload_path, $malicious_files, 0 );
    }

    // --- Zone Rouge 2 : Vérification du wp-config.php ---
    $wp_config_path = ABSPATH . 'wp-config.php';
    if ( ! file_exists( $wp_config_path ) ) {
        $wp_config_path = dirname( ABSPATH ) . '/wp-config.php';
    }

    if ( file_exists( $wp_config_path ) ) {
        $content = @file_get_contents( $wp_config_path ); 
        if ( $content && preg_match( '/(eval\s*\(|base64_decode\s*\(|str_rot13\s*\()/i', $content ) ) {
            $malicious_files[] = [
                'file'     => 'wp-config.php',
                'threat'   => 'Code obfusqué détecté (Injection de Backdoor probable)',
                'severity' => 'critical'
            ];
        }
    }

    // On renvoie un JSON propre, séparé du reste de l'infrastructure
    return rest_ensure_response( [
        'timestamp'    => current_time( 'mysql' ),
        'status'       => 'scan_completed',
        'malware_scan' => $malicious_files
    ] );
}


/**
 * 10. Module d'Intervention : Suppression de fichier malveillant
 */
function iweb_delete_malicious_file( WP_REST_Request $request ) {
    $params = $request->get_json_params();
    $file_path = isset( $params['file_path'] ) ? sanitize_text_field( $params['file_path'] ) : '';

    if ( empty( $file_path ) ) {
        return new WP_Error( 'missing_param', 'Chemin du fichier manquant.', [ 'status' => 400 ] );
    }

    // 🚨 SÉCURITÉ ABSOLUE : On interdit la suppression hors du dossier uploads
    if ( strpos( $file_path, 'wp-content/uploads' ) === false ) {
        return new WP_Error( 
            'forbidden_path', 
            'Intervention refusée : Ce fichier est un fichier systeme. Nettoyage manuel requis via FTP.', 
            [ 'status' => 403 ] 
        );
    }

    // Construction du chemin absolu
    $absolute_path = ABSPATH . ltrim( $file_path, '/' );

    if ( ! file_exists( $absolute_path ) ) {
        return new WP_Error( 'not_found', 'Fichier introuvable. Il a peut-etre deja ete supprime.', [ 'status' => 404 ] );
    }

    // Tentative de suppression (unlink)
    if ( unlink( $absolute_path ) ) {
        return rest_ensure_response( [ 
            'success' => true, 
            'message' => "Le payload malveillant a ete detruit avec succes." 
        ] );
    } else {
        return new WP_Error( 'delete_failed', 'Impossible de supprimer le fichier. Verifiez les permissions (CHMOD) du serveur.', [ 'status' => 500 ] );
    }
}