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
        'security_events' => $security_events // <-- Les événements sont maintenant envoyés au Dashboard !
    ] );
}


/**
 * 6. Moteur de journalisation centralisé (SecOps Logger)
 * Cette fonction simplifie l'enregistrement de n'importe quel événement.
 */
function iweb_log_security_event( $event_type, $severity, $message ) {
    $ip = isset( $_SERVER['REMOTE_ADDR'] ) ? $_SERVER['REMOTE_ADDR'] : 'IP_Inconnue';
    $time = current_time( 'mysql' );

    $logs = get_transient( 'iweb_security_logs' ) ?: [];

    $logs[] = [
        'event_type' => $event_type,
        'severity'   => $severity,     // 'low', 'medium', 'high', 'critical'
        'message'    => $message,
        'ip'         => $ip,
        'time'       => $time
    ];

    // Limiter la taille du journal pour préserver la mémoire (FIFO : on garde les 50 derniers)
    if ( count( $logs ) > 50 ) {
        array_shift( $logs );
    }

    set_transient( 'iweb_security_logs', $logs, DAY_IN_SECONDS );
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


