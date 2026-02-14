use crawler::{build_app, config::Config, jobs::JobManager, AppState};
use std::sync::Arc;
use tracing_subscriber::{fmt, EnvFilter};

#[tokio::main]
async fn main() {
    // Initialize tracing with RUST_LOG env filter (defaults to "info")
    fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    // Load configuration from environment variables
    let config =
        Arc::new(Config::from_env().expect("Failed to load configuration from environment"));
    let port = config.port;

    let job_manager = Arc::new(JobManager::new(config.clone()));

    let state = AppState {
        config: config.clone(),
        job_manager,
    };

    let app = build_app(state);

    let addr = format!("0.0.0.0:{port}");
    tracing::info!("Crawler service starting on {addr}");

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind to address");

    axum::serve(listener, app).await.expect("Server error");
}
