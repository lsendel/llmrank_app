use aws_config::Region;
use aws_credential_types::Credentials;
use aws_sdk_s3::Client as S3Client;
use aws_sdk_s3::config::Builder as S3ConfigBuilder;
use aws_sdk_s3::primitives::ByteStream;
use flate2::write::GzEncoder;
use flate2::Compression;
use std::io::Write;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum StorageError {
    #[error("S3 upload error: {0}")]
    UploadError(String),
    #[error("Gzip compression error: {0}")]
    CompressionError(#[from] std::io::Error),
}

/// Client for uploading content to R2/S3-compatible storage.
pub struct StorageClient {
    client: S3Client,
    bucket: String,
}

/// Configuration needed to create a StorageClient.
pub struct StorageConfig {
    pub endpoint: String,
    pub access_key: String,
    pub secret_key: String,
    pub bucket: String,
}

impl StorageClient {
    /// Create a new StorageClient configured for Cloudflare R2 (or any S3-compatible endpoint).
    pub fn new(config: StorageConfig) -> Self {
        let credentials = Credentials::new(
            &config.access_key,
            &config.secret_key,
            None,
            None,
            "r2-static",
        );

        let s3_config = S3ConfigBuilder::new()
            .endpoint_url(&config.endpoint)
            .region(Region::new("auto"))
            .credentials_provider(credentials)
            .force_path_style(true)
            .behavior_version_latest()
            .build();

        let client = S3Client::from_conf(s3_config);

        StorageClient {
            client,
            bucket: config.bucket,
        }
    }

    /// Upload gzipped HTML content to the given key.
    pub async fn upload_html(&self, key: &str, html_content: &str) -> Result<(), StorageError> {
        let compressed = gzip_bytes(html_content.as_bytes())?;

        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .body(ByteStream::from(compressed))
            .content_type("text/html")
            .content_encoding("gzip")
            .send()
            .await
            .map_err(|e| StorageError::UploadError(e.to_string()))?;

        Ok(())
    }

    /// Upload gzipped JSON content to the given key.
    pub async fn upload_json(&self, key: &str, json_content: &str) -> Result<(), StorageError> {
        let compressed = gzip_bytes(json_content.as_bytes())?;

        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .body(ByteStream::from(compressed))
            .content_type("application/json")
            .content_encoding("gzip")
            .send()
            .await
            .map_err(|e| StorageError::UploadError(e.to_string()))?;

        Ok(())
    }
}

/// Compress bytes using gzip.
fn gzip_bytes(data: &[u8]) -> Result<Vec<u8>, std::io::Error> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(data)?;
    encoder.finish()
}

#[cfg(test)]
mod tests {
    use super::*;
    use flate2::read::GzDecoder;
    use std::io::Read;

    #[test]
    fn test_gzip_roundtrip() {
        let original = "Hello, this is some test content for gzip compression!";
        let compressed = gzip_bytes(original.as_bytes()).unwrap();

        // Verify it's actually compressed (should be different from original)
        assert_ne!(compressed, original.as_bytes());

        // Decompress and verify
        let mut decoder = GzDecoder::new(&compressed[..]);
        let mut decompressed = String::new();
        decoder.read_to_string(&mut decompressed).unwrap();
        assert_eq!(decompressed, original);
    }

    #[test]
    fn test_gzip_empty() {
        let compressed = gzip_bytes(b"").unwrap();
        let mut decoder = GzDecoder::new(&compressed[..]);
        let mut decompressed = String::new();
        decoder.read_to_string(&mut decompressed).unwrap();
        assert_eq!(decompressed, "");
    }
}
