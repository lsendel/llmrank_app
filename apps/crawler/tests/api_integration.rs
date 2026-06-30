use axum::http::StatusCode;
use axum_test::TestServer;
use crawler::{build_app, config::Config, jobs::JobManager, AppState};
use hmac::{Hmac, Mac};
use serde_json::json;
use sha2::Sha256;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;

fn create_test_config() -> Config {
    Config {
        shared_secret: "test_secret".to_string(),
        r2_access_key: "test_key".to_string(),
        r2_secret_key: "test_secret".to_string(),
        r2_endpoint: "http://localhost:9000".to_string(),
        r2_bucket: "test_bucket".to_string(),
        api_base_url: "http://localhost:8787".to_string(),
        port: 8080,
        max_concurrent_jobs: 1,
        max_concurrent_fetches: 1,
        max_concurrent_lighthouse: 1,
        max_concurrent_renderers: 1,
        renderer_script_path: "/app/scripts/render-links.mjs".to_string(),
        batch_page_threshold: 25,
        batch_interval_secs: 15,
    }
}

fn compute_signature(body: &str, timestamp: &str, secret: &str) -> String {
    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC can take key of any size");
    mac.update(timestamp.as_bytes());
    mac.update(body.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

#[tokio::test]
async fn test_create_and_check_job() {
    let config = Arc::new(create_test_config());
    let job_manager = Arc::new(JobManager::new(config.clone()));
    let state = AppState {
        config: config.clone(),
        job_manager,
    };

    let app = build_app(state);
    let server = TestServer::new(app).unwrap();

    let job_payload = json!({
        "job_id": "test-job-123",
        "callback_url": "http://localhost:3000/callback",
        "config": {
            "seed_urls": ["https://example.com"],
            "max_pages": 1,
            "max_depth": 1,
            "respect_robots": false, // Avoid network calls if possible, but fetcher will still run
            "run_lighthouse": false,
            "extract_schema": false,
            "extract_links": false,
            "check_llms_txt": false,
            "user_agent": "TestBot",
            "rate_limit_ms": 100,
            "timeout_s": 5
        }
    });

    let body_str = serde_json::to_string(&job_payload).unwrap();
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
        .to_string();
    let signature = compute_signature(&body_str, &timestamp, &config.shared_secret);

    // 1. Submit Job
    let response = server
        .post("/api/v1/jobs")
        .add_header("X-Timestamp", timestamp)
        .add_header("X-Signature", signature)
        .json(&job_payload)
        .await;

    response.assert_status(StatusCode::ACCEPTED);
    let json = response.json::<serde_json::Value>();
    assert_eq!(json["job_id"], "test-job-123");
    assert_eq!(json["status"], "queued");

    // 2. Check Job Status
    // We reuse the same timestamp/signature logic for GET if required?
    // Wait, the GET route signature depends on body being empty?
    // Let's check verify_hmac implementation.
    // If it's GET, body is empty.

    let timestamp_get = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
        .to_string();
    // For GET request with no body, we sign empty string?
    // Let's assume verify_hmac handles empty body by reading bytes.
    // If body is empty, bytes are empty.

    let signature_get = compute_signature("", &timestamp_get, &config.shared_secret);

    let status_response = server
        .get("/api/v1/jobs/test-job-123/status")
        .add_header("X-Timestamp", timestamp_get)
        .add_header("X-Signature", signature_get)
        .await;

    status_response.assert_status(StatusCode::OK);
    let status_json = status_response.json::<serde_json::Value>();
    assert_eq!(status_json["job_id"], "test-job-123");
    // Status might be Queued, Crawling, or Failed (if fetch fails immediately).
    // Just asserting it exists is good enough for integration test of the API layer.
    let status_str = status_json["status"].as_str().unwrap();
    assert!(["queued", "crawling", "failed", "pending"].contains(&status_str));
}
