CREATE TABLE admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  reason text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_target ON admin_audit_logs(target_type, target_id);
