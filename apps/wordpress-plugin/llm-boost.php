<?php
/**
 * Plugin Name: LLM Rank — AI SEO Optimization
 * Plugin URI: https://llmboost.com/wordpress
 * Description: Optimize your WordPress site for AI search engines (ChatGPT, Claude, Perplexity). Generates llms.txt and provides AI-readiness insights.
 * Version: 1.0.0
 * Author: LLM Rank Team
 * License: GPL2
 */

if (!defined('ABSPATH')) {
    exit;
}

// Autoload classes
spl_autoload_register(function ($class) {
    $prefix = 'LLMBoost';
    $base_dir = __DIR__ . '/src/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relative_class = substr($class, $len);
    $file = $base_dir . str_replace('', '/', $relative_class) . '.php';

    if (file_exists($file)) {
        require $file;
    }
});

// Initialize the plugin
function llm_boost_init() {
    new \LLMBoost\Admin\Settings();
    new \LLMBoost\Generator\LLMSTxt();
}

add_action('plugins_loaded', 'llm_boost_init');
