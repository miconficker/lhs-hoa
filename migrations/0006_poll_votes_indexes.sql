-- Add indexes for poll_votes table
PRAGMA foreign_keys = ON;

-- Index for getting votes by poll
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON poll_votes(poll_id);

-- Composite index for checking user votes
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_household ON poll_votes(poll_id, household_id);

-- Index for getting weighted votes (aggregation)
CREATE INDEX IF NOT EXISTS idx_poll_votes_selected_option ON poll_votes(selected_option);
