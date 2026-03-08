import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { MessageSquare, Plus, Send, Users } from "lucide-react";
import type { MessageThread, ThreadParticipant, Message } from "@/types";

export function MessagesPage() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedThread, setSelectedThread] =
    useState<MessageThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNewThread, setShowNewThread] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadThreads();
  }, []);

  async function loadThreads() {
    setLoading(true);
    setError("");

    const result = await api.messages.getThreads(50, 0);

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setThreads(result.data.threads);
    }

    setLoading(false);
  }

  async function loadThread(threadId: string) {
    const result = await api.messages.getThread(threadId);

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setSelectedThread(result.data);
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedThread || sending) return;

    setSending(true);
    setError("");

    const result = await api.messages.sendMessage(selectedThread.thread.id, {
      body: newMessage,
    });

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setNewMessage("");
      // Reload thread to get new message
      await loadThread(selectedThread.thread.id);
      // Update thread in list
      await loadThreads();
    }

    setSending(false);
  }

  async function createThread(input: {
    subject?: string;
    participant_ids: string[];
    body: string;
  }) {
    const result = await api.messages.createThread(input);

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setShowNewThread(false);
      loadThreads();
      loadThread(result.data.thread_id);
    }
  }

  if (loading && threads.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Threads List */}
      <div className="w-1/3 bg-card rounded-lg shadow flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-card-foreground">Messages</h1>
            <button
              onClick={() => setShowNewThread(true)}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
              title="New message"
            >
              <Plus className="w-5 h-5 text-card-foreground" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No messages yet</p>
              <p className="text-sm">Start a conversation!</p>
            </div>
          ) : (
            threads.map((thread) => (
              <div
                key={thread.id}
                onClick={() => loadThread(thread.id)}
                className={`p-4 border-b border-border cursor-pointer hover:bg-accent transition-colors ${
                  selectedThread?.thread.id === thread.id ? "bg-accent" : ""
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-semibold text-card-foreground truncate flex-1">
                    {thread.subject || "No Subject"}
                  </h3>
                  {thread.unread_count && thread.unread_count > 0 ? (
                    <span className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">
                      {thread.unread_count}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  {thread.category}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {thread.updated_at
                    ? format(new Date(thread.updated_at), "MMM d, h:mm a")
                    : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Message View */}
      <div className="flex-1 bg-card rounded-lg shadow flex flex-col">
        {selectedThread ? (
          <>
            {/* Thread Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-card-foreground">
                    {selectedThread.thread.subject || "No Subject"}
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>
                      {selectedThread.participants.length} participant
                      {selectedThread.participants.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedThread.messages.map((message) => {
                const isOwn = message.sender_id === user?.id;
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        isOwn
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-card-foreground"
                      }`}
                    >
                      {!isOwn && (
                        <p className="text-xs font-semibold mb-1 opacity-75">
                          {message.sender_name || message.sender_email}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.body}
                      </p>
                      {message.attachment_url && (
                        <a
                          href={message.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs underline mt-2 block"
                        >
                          {message.attachment_name || "Attachment"}
                        </a>
                      )}
                      <p className="text-xs opacity-75 mt-1">
                        {format(new Date(message.created_at), "h:mm a")}
                        {message.is_edited && " (edited)"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-border">
              {error && (
                <div className="mb-2 text-sm text-destructive">{error}</div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" && !e.shiftKey && sendMessage()
                  }
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-input rounded-lg focus:ring-primary focus:border-primary"
                  disabled={sending}
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !newMessage.trim()}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* New Thread Modal */}
      {showNewThread && (
        <NewThreadModal
          onClose={() => setShowNewThread(false)}
          onSubmit={createThread}
        />
      )}
    </div>
  );
}

// Helper interface for detail view
interface MessageThreadDetail {
  thread: MessageThread;
  participants: ThreadParticipant[];
  messages: Message[];
}

// New Thread Modal Component
function NewThreadModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: {
    subject?: string;
    participant_ids: string[];
    body: string;
  }) => Promise<void>;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || participantIds.length === 0) {
      setError("Please add at least one recipient and a message");
      return;
    }

    setSubmitting(true);
    setError("");

    await onSubmit({
      subject: subject || undefined,
      participant_ids: participantIds,
      body,
    });

    setSubmitting(false);
  }

  // This is simplified - in real implementation, you'd fetch user list
  // For now, users would need to know user IDs

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl max-w-lg w-full mx-4">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-card-foreground">
            New Message
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1">
              Subject (optional)
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1">
              Recipient User IDs (comma-separated)
            </label>
            <input
              type="text"
              value={participantIds.join(", ")}
              onChange={(e) =>
                setParticipantIds(
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
              className="w-full px-3 py-2 border border-input rounded-lg focus:ring-primary focus:border-primary"
              placeholder="user-id-1, user-id-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter user IDs separated by commas
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-input rounded-lg focus:ring-primary focus:border-primary"
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-input rounded-lg hover:bg-accent"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
