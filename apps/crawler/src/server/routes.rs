use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse,
    },
    Json,
};
use futures::stream::{Stream, StreamExt};
use serde_json::json;

use crate::models::CrawlJobPayload;
use crate::AppState;

/// POST /api/v1/jobs
///
/// Accepts a new crawl job payload. Validates the input and returns 202 Accepted.
/// Actual job processing will be wired up in Task 8.
pub async fn create_job(
    State(state): State<AppState>,
    Json(payload): Json<CrawlJobPayload>,
) -> impl IntoResponse {
    tracing::info!(
        job_id = %payload.job_id,
        seed_urls = ?payload.config.seed_urls,
        max_pages = payload.config.max_pages,
        "Received crawl job"
    );

    state.job_manager.submit(payload.clone()).await;

    (
        StatusCode::ACCEPTED,
        Json(json!({
            "job_id": payload.job_id,
            "status": "queued"
        })),
    )
}

/// GET /api/v1/jobs/:id/status
///
/// Returns the current status of a crawl job. Stub implementation for now.
pub async fn get_job_status(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
) -> impl IntoResponse {
    tracing::info!(job_id = %job_id, "Status request");

    let status = state.job_manager.status(&job_id).await;

    (StatusCode::OK, Json(status))
}

/// POST /api/v1/jobs/:id/cancel
///
/// Cancels a running crawl job. Stub implementation for now.
pub async fn cancel_job(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
) -> impl IntoResponse {
    tracing::info!(job_id = %job_id, "Cancel request");

    state.job_manager.cancel(&job_id).await;

    (
        StatusCode::OK,
        Json(json!({
            "job_id": job_id,
            "status": "cancelled"
        })),
    )
}

/// GET /api/v1/jobs/:id/events
///
/// Server-Sent Events endpoint for real-time crawl progress streaming.
pub async fn crawl_events(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
) -> Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>> {
    let rx = state.job_manager.subscribe_events(&job_id).await;
    let stream = tokio_stream::wrappers::BroadcastStream::new(rx).filter_map(|msg| async {
        match msg {
            Ok(data) => Some(Ok(Event::default().data(data))),
            Err(_) => None,
        }
    });
    Sse::new(stream).keep_alive(KeepAlive::default())
}

/// GET /api/v1/health
///
/// Health check endpoint with aggregate metrics.
pub async fn health(State(state): State<AppState>) -> impl IntoResponse {
    let metrics = state.job_manager.metrics().await;
    Json(json!({
        "status": "ok",
        "active_jobs": metrics.active_jobs,
        "total_pages_crawled": metrics.total_pages_crawled,
        "total_pages_errored": metrics.total_pages_errored,
        "uptime_secs": metrics.uptime_secs,
    }))
}
