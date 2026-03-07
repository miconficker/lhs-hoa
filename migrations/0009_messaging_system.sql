-- Messaging System Migration
-- Supports user-to-user messaging with threading

-- Message threads table (conversations)
CREATE TABLE IF NOT EXISTS message_threads (
  id TEXT PRIMARY KEY,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  subject TEXT,
  -- For group messages or tracking specific context
  category TEXT DEFAULT 'general' CHECK(category IN ('general', 'service_request', 'payment', 'reservation', 'admin'))
);

-- Participants in message threads (many-to-many relationship)
CREATE TABLE IF NOT EXISTS thread_participants (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  -- Track read status and last read timestamp
  last_read_at TEXT,
  -- Track if user has left the thread
  is_active INTEGER DEFAULT 1 NOT NULL CHECK(is_active IN (0, 1)),
  joined_at TEXT DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  body TEXT NOT NULL,
  -- For attachments (file paths in R2)
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  -- Message status
  is_edited INTEGER DEFAULT 0 NOT NULL CHECK(is_edited IN (0, 1)),
  edited_at TEXT,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_thread_participants_thread_id ON thread_participants(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_participants_user_id ON thread_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_thread_participants_active ON thread_participants(is_active);

CREATE INDEX IF NOT EXISTS idx_message_threads_updated_at ON message_threads(updated_at DESC);

-- Trigger to update thread's updated_at when new message is added
CREATE TRIGGER IF NOT EXISTS update_thread_timestamp
AFTER INSERT ON messages
BEGIN
  UPDATE message_threads
  SET updated_at = datetime('now')
  WHERE id = NEW.thread_id;
END;

-- Trigger to update thread's updated_at when message is edited
CREATE TRIGGER IF NOT EXISTS update_thread_timestamp_on_edit
AFTER UPDATE OF is_edited ON messages
WHEN NEW.is_edited = 1
BEGIN
  UPDATE message_threads
  SET updated_at = datetime('now')
  WHERE id = NEW.thread_id;
END;
