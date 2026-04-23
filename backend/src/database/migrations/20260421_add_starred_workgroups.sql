-- Add starred workgroups table
CREATE TABLE IF NOT EXISTS starred_workgroups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workgroup_id UUID NOT NULL REFERENCES workgroups(id) ON DELETE CASCADE,
    starred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, workgroup_id)
);

CREATE INDEX idx_starred_workgroups_user_id ON starred_workgroups(user_id);
CREATE INDEX idx_starred_workgroups_workgroup_id ON starred_workgroups(workgroup_id);

COMMENT ON TABLE starred_workgroups IS 'User-specific starred/favorited workgroups';
