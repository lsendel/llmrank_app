pub mod config;
pub mod crawler;
pub mod jobs;
pub mod lighthouse;
pub mod models;
pub mod server;
pub mod storage;

use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::config::Config;
use crate::jobs::JobManager;

/// Shared application state passed to all Axum handlers.
#[derive(Debug, Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub job_manager: Arc<JobManager>,
}

pub fn build_app(state: AppState) -> Router {
    // CORS layer — permissive for the internal service
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Routes that require HMAC authentication
    let authenticated_routes = Router::new()
        .route("/api/v1/jobs", post(server::routes::create_job))
        .route(
            "/api/v1/jobs/:id/status",
            get(server::routes::get_job_status),
        )
        .route("/api/v1/jobs/:id/cancel", post(server::routes::cancel_job))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            server::auth::verify_hmac,
        ));

    // Public routes (no auth required)
    let public_routes = Router::new().route("/api/v1/health", get(server::routes::health));

    // Combine all routes
    Router::new()
        .merge(authenticated_routes)
        .merge(public_routes)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
