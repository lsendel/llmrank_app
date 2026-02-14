use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::AppState;

type HmacSha256 = Hmac<Sha256>;

/// Maximum allowed clock skew for HMAC timestamp verification (5 minutes).
const MAX_TIMESTAMP_DRIFT_SECS: u64 = 300;

/// Axum middleware that verifies HMAC-SHA256 signatures on incoming requests.
///
/// Expects two headers:
/// - `X-Signature`: hex-encoded HMAC-SHA256 of (timestamp + request body)
/// - `X-Timestamp`: Unix timestamp (seconds) when the request was signed
///
/// The shared secret is read from application state.
pub async fn verify_hmac(
    State(state): State<AppState>,
    request: Request<Body>,
    next: Next,
) -> Response {
    // Extract headers before consuming the request
    let signature = match request.headers().get("X-Signature") {
        Some(v) => match v.to_str() {
            Ok(s) => s.to_string(),
            Err(_) => {
                return (StatusCode::UNAUTHORIZED, "Invalid X-Signature header").into_response();
            }
        },
        None => {
            return (StatusCode::UNAUTHORIZED, "Missing X-Signature header").into_response();
        }
    };

    let timestamp_str = match request.headers().get("X-Timestamp") {
        Some(v) => match v.to_str() {
            Ok(s) => s.to_string(),
            Err(_) => {
                return (StatusCode::UNAUTHORIZED, "Invalid X-Timestamp header").into_response();
            }
        },
        None => {
            return (StatusCode::UNAUTHORIZED, "Missing X-Timestamp header").into_response();
        }
    };

    // Verify timestamp is within acceptable range
    let timestamp: u64 = match timestamp_str.parse() {
        Ok(ts) => ts,
        Err(_) => {
            return (StatusCode::UNAUTHORIZED, "Invalid timestamp format").into_response();
        }
    };

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let drift = now.abs_diff(timestamp);

    if drift > MAX_TIMESTAMP_DRIFT_SECS {
        return (
            StatusCode::UNAUTHORIZED,
            "Timestamp too far from current time",
        )
            .into_response();
    }

    // Read the body for HMAC verification
    let (parts, body) = request.into_parts();
    let body_bytes = match axum::body::to_bytes(body, 10 * 1024 * 1024).await {
        Ok(bytes) => bytes,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, "Failed to read request body").into_response();
        }
    };

    // Compute HMAC-SHA256 of (timestamp + body)
    let mut mac = match HmacSha256::new_from_slice(state.config.shared_secret.as_bytes()) {
        Ok(mac) => mac,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "HMAC initialization failed",
            )
                .into_response();
        }
    };
    mac.update(timestamp_str.as_bytes());
    mac.update(&body_bytes);

    let expected = hex::encode(mac.finalize().into_bytes());

    // Strip "hmac-sha256=" prefix if present (API sends this format)
    let provided_hex = signature.strip_prefix("hmac-sha256=").unwrap_or(&signature);

    if expected != provided_hex {
        return (
            StatusCode::UNAUTHORIZED,
            "HMAC signature verification failed",
        )
            .into_response();
    }

    // Reconstruct the request with the body so downstream handlers can read it
    let request = Request::from_parts(parts, Body::from(body_bytes));
    next.run(request).await
}
