use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{Duration, Instant};

#[derive(Debug, Clone)]
enum CircuitState {
    Closed,
    Open { until: Instant },
    HalfOpen,
}

#[derive(Debug, Clone)]
struct DomainCircuit {
    state: CircuitState,
    failure_count: u32,
}

pub struct CircuitBreaker {
    circuits: Arc<RwLock<HashMap<String, DomainCircuit>>>,
    failure_threshold: u32,
    recovery_timeout: Duration,
}

impl CircuitBreaker {
    pub fn new(failure_threshold: u32, recovery_timeout_secs: u64) -> Self {
        Self {
            circuits: Arc::new(RwLock::new(HashMap::new())),
            failure_threshold,
            recovery_timeout: Duration::from_secs(recovery_timeout_secs),
        }
    }

    pub async fn is_allowed(&self, domain: &str) -> bool {
        let mut circuits = self.circuits.write().await;
        let circuit = circuits.entry(domain.to_string()).or_insert(DomainCircuit {
            state: CircuitState::Closed,
            failure_count: 0,
        });
        match &circuit.state {
            CircuitState::Closed => true,
            CircuitState::Open { until } => {
                if Instant::now() >= *until {
                    circuit.state = CircuitState::HalfOpen;
                    true // allow one probe request
                } else {
                    false
                }
            }
            CircuitState::HalfOpen => true,
        }
    }

    pub async fn record_success(&self, domain: &str) {
        let mut circuits = self.circuits.write().await;
        if let Some(circuit) = circuits.get_mut(domain) {
            circuit.state = CircuitState::Closed;
            circuit.failure_count = 0;
        }
    }

    pub async fn record_failure(&self, domain: &str) {
        let mut circuits = self.circuits.write().await;
        let circuit = circuits.entry(domain.to_string()).or_insert(DomainCircuit {
            state: CircuitState::Closed,
            failure_count: 0,
        });
        circuit.failure_count += 1;
        if circuit.failure_count >= self.failure_threshold {
            circuit.state = CircuitState::Open {
                until: Instant::now() + self.recovery_timeout,
            };
            tracing::warn!(domain = %domain, failures = circuit.failure_count, "Circuit breaker opened");
        }
    }
}
