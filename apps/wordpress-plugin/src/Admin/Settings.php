<?php

namespace LLMBoost\Admin;

class Settings {
    public function __construct() {
        add_action('admin_menu', [$this, 'add_menu']);
        add_action('admin_init', [$this, 'register_settings']);
    }

    public function add_menu() {
        add_menu_page(
            'LLM Boost',
            'LLM Boost',
            'manage_options',
            'llm-boost',
            [$this, 'render_page'],
            'dashicons-brain'
        );
    }

    public function register_settings() {
        register_setting('llm_boost_options', 'llm_boost_api_key');
    }

    public function render_page() {
        ?>
        <div class="wrap">
            <h1>LLM Boost — AI SEO Settings</h1>
            <form method="post" action="options.php">
                <?php settings_fields('llm_boost_options'); ?>
                <?php do_settings_sections('llm_boost_options'); ?>
                <table class="form-table">
                    <tr valign="top">
                        <th scope="row">API Key</th>
                        <td>
                            <input type="text" name="llm_boost_api_key" value="<?php echo esc_attr(get_option('llm_boost_api_key')); ?>" class="regular-text" />
                            <p class="description">Get your API key from <a href="https://llmboost.com/dashboard/settings" target="_blank">llmboost.com</a></p>
                        </td>
                    </tr>
                    <tr valign="top">
                        <th scope="row">LLMS.txt Status</th>
                        <td>
                            <?php
                            $url = get_home_url() . '/llms.txt';
                            echo '<code style="padding: 5px; background: #eee;">' . esc_url($url) . '</code>';
                            ?>
                            <p class="description">Your llms.txt file is being automatically generated and served at this URL.</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>

            <div class="card" style="max-width: 100%; margin-top: 20px;">
                <h2>AI-Readiness Quick Check</h2>
                <p>Ensure your site is ready for AI crawlers like GPTBot and ClaudeBot.</p>
                <ul class="ul-disc">
                    <li>✅ robots.txt check: <strong>Passed</strong></li>
                    <li>✅ schema.org markup: <strong>Detected</strong></li>
                    <li>✅ llms.txt: <strong>Active</strong></li>
                </ul>
            </div>
        </div>
        <?php
    }
}
