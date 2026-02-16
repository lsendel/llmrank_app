<?php

namespace LLMBoost\Generator;

class LLMSTxt {
    public function __construct() {
        add_action('init', [$this, 'add_rewrite_rules']);
        add_filter('query_vars', [$this, 'add_query_vars']);
        add_action('template_redirect', [$this, 'render_llms_txt']);
    }

    public function add_rewrite_rules() {
        add_rewrite_rule('^llms\.txt$', 'index.php?llm_boost_action=llms_txt', 'top');
    }

    public function add_query_vars($vars) {
        $vars[] = 'llm_boost_action';
        return $vars;
    }

    public function render_llms_txt() {
        if (get_query_var('llm_boost_action') === 'llms_txt') {
            header('Content-Type: text/plain; charset=utf-8');
            echo $this->generate_content();
            exit;
        }
    }

    private function generate_content() {
        $site_name = get_bloginfo('name');
        $site_description = get_bloginfo('description');
        $site_url = get_home_url();

        $output = "# {$site_name}

";
        $output .= "> {$site_description}

";

        // Main Sections
        $output .= "## Core Pages

";
        $output .= "- [Home]({$site_url})
";

        // Blog Posts
        $posts = get_posts(['numberposts' => 10]);
        if ($posts) {
            $output .= "
## Latest Content

";
            foreach ($posts as $post) {
                $url = get_permalink($post->ID);
                $title = get_the_title($post->ID);
                $output .= "- [{$title}]({$url})
";
            }
        }

        return apply_filters('llm_boost_llms_txt_content', $output);
    }
}
