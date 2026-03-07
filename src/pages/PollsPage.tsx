import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api, CreatePollInput, type AdminUser } from "@/lib/api";
import {
  format,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
} from "date-fns";
import {
  Plus,
  Trash2,
  BarChart,
  CheckCircle,
  UserCheck,
  X,
} from "lucide-react";

interface PollWithResults {
  id: string;
  question: string;
  options: string[];
  ends_at: string;
  created_by: string;
  created_at: string;
  votes?: { option: string; count: number }[];
  total_votes?: number;
}

interface VoteStatus {
  [pollId: string]: boolean;
}

interface InPersonVoteModal {
  pollId: string;
  pollQuestion: string;
  options: string[];
}

export function PollsPage() {
  const { user } = useAuth();
  const [polls, setPolls] = useState<PollWithResults[]>([]);
  const [voteStatus, setVoteStatus] = useState<VoteStatus>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<{
    [pollId: string]: string;
  }>({});
  const [showInPersonVoteModal, setShowInPersonVoteModal] =
    useState<InPersonVoteModal | null>(null);
  const [homeowners, setHomeowners] = useState<AdminUser[]>([]);
  const [inPersonVoteForm, setInPersonVoteForm] = useState({
    household_id: "",
    selected_option: "",
    voted_at: new Date().toISOString().slice(0, 16),
    witness: "",
  });
  const [voteSuccess, setVoteSuccess] = useState("");
  const [votedHouseholds, setVotedHouseholds] = useState<Set<string>>(
    new Set(),
  );

  const isAdmin = user?.role === "admin";
  // For demo purposes, use user ID as household ID
  // In production, this would come from user's household association
  const householdId = user?.id || "demo-household";

  useEffect(() => {
    loadPolls();
    if (isAdmin) {
      loadHomeowners();
    }
  }, []);

  async function loadPolls() {
    setLoading(true);
    setError("");

    const result = await api.polls.list();

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      const pollsList = result.data.polls;
      setPolls(pollsList);

      // Check vote status for each poll if we have a household ID
      if (householdId) {
        const statusPromises = pollsList.map(async (poll) => {
          const voteResult = await api.polls.getMyVote(poll.id, householdId);
          return { pollId: poll.id, voted: voteResult.data?.voted || false };
        });

        const statuses = await Promise.all(statusPromises);
        const statusMap: VoteStatus = {};
        statuses.forEach((s) => {
          statusMap[s.pollId] = s.voted;
        });
        setVoteStatus(statusMap);
      }
    }

    setLoading(false);
  }

  async function loadHomeowners() {
    const result = await api.admin.getHomeowners();
    if (result.data) {
      setHomeowners(result.data.homeowners);
    }
  }

  async function handleVote(pollId: string) {
    const selectedOption = selectedOptions[pollId];
    if (!selectedOption || !householdId) return;

    const result = await api.polls.vote(pollId, {
      household_id: householdId,
      selected_option: selectedOption,
    });

    if (result.error) {
      setError(result.error);
      return;
    }

    // Reload polls to get updated results
    await loadPolls();
    setSelectedOptions({ ...selectedOptions, [pollId]: "" });
  }

  async function handleDeletePoll(pollId: string) {
    if (!confirm("Are you sure you want to delete this poll?")) return;

    const result = await api.polls.delete(pollId);
    if (result.error) {
      setError(result.error);
    } else {
      await loadPolls();
    }
  }

  async function handleCreatePoll(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const question = formData.get("question") as string;
    const endsAt = formData.get("ends_at") as string;

    // Collect options
    const options: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const option = formData.get(`option${i}`) as string;
      if (option?.trim()) {
        options.push(option.trim());
      }
    }

    if (options.length < 2) {
      setError("Please provide at least 2 options");
      return;
    }

    const input: CreatePollInput = {
      question,
      options,
      ends_at: endsAt,
    };

    const result = await api.polls.create(input);
    if (result.error) {
      setError(result.error);
    } else {
      setShowCreateForm(false);
      await loadPolls();
    }
  }

  function openInPersonVoteModal(poll: PollWithResults) {
    setShowInPersonVoteModal({
      pollId: poll.id,
      pollQuestion: poll.question,
      options: poll.options,
    });
    setInPersonVoteForm({
      household_id: "",
      selected_option: "",
      voted_at: new Date().toISOString().slice(0, 16),
      witness: "",
    });
    setError("");
    setVoteSuccess("");
  }

  async function handleRecordInPersonVote(e: React.FormEvent) {
    e.preventDefault();
    if (!showInPersonVoteModal) return;

    const { household_id, selected_option, voted_at, witness } =
      inPersonVoteForm;

    if (!household_id || !selected_option) {
      setError("Please select a homeowner and an option");
      return;
    }

    // Check if household has already voted
    if (votedHouseholds.has(household_id)) {
      setError("This household has already voted on this poll");
      return;
    }

    const result = await api.admin.recordInPersonVote(
      showInPersonVoteModal.pollId,
      {
        household_id,
        selected_option,
        voted_at: new Date(voted_at).toISOString(),
        witness: witness || undefined,
      },
    );

    if (result.error) {
      setError(result.error);
      return;
    }

    setVoteSuccess("Vote recorded successfully!");
    setVotedHouseholds(new Set([...votedHouseholds, household_id]));
    setInPersonVoteForm({
      household_id: "",
      selected_option: "",
      voted_at: new Date().toISOString().slice(0, 16),
      witness: "",
    });

    // Reload polls after a short delay
    setTimeout(async () => {
      await loadPolls();
      setVoteSuccess("");
    }, 1500);
  }

  function getTimeRemaining(endsAt: string): string {
    const now = new Date();
    const end = new Date(endsAt);

    if (end < now) return "Expired";

    const days = differenceInDays(end, now);
    const hours = differenceInHours(end, now);
    const minutes = differenceInMinutes(end, now);

    if (days > 0) {
      return `${days} day${days > 1 ? "s" : ""} remaining`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? "s" : ""} remaining`;
    } else {
      return `${minutes} minute${minutes > 1 ? "s" : ""} remaining`;
    }
  }

  function getVotePercentage(count: number, total: number): number {
    if (!total || total === 0) return 0;
    return Math.round((count / total) * 100);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-card-foreground">
          Community Polls
        </h1>
        {isAdmin && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-5 h-5" />
            New Poll
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreateForm && isAdmin && (
        <div className="bg-card rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Create New Poll</h2>
          <form onSubmit={handleCreatePoll} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">
                Question
              </label>
              <input
                type="text"
                name="question"
                required
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-primary-500 focus:border-primary-500"
                placeholder="What would you like to ask the community?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">
                Options (minimum 2)
              </label>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <input
                    key={i}
                    type="text"
                    name={`option${i}`}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    placeholder={`Option ${i}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">
                Ends At
              </label>
              <input
                type="datetime-local"
                name="ends_at"
                required
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Create Poll
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Polls List */}
      <div className="space-y-6">
        {polls.length > 0 ? (
          polls.map((poll) => {
            const hasVoted = voteStatus[poll.id];
            const timeRemaining = getTimeRemaining(poll.ends_at);

            return (
              <div key={poll.id} className="bg-card rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {hasVoted && (
                        <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                          <CheckCircle className="w-3 h-3" />
                          Voted
                        </span>
                      )}
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          timeRemaining === "Expired"
                            ? "bg-muted text-muted-foreground"
                            : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        }`}
                      >
                        {timeRemaining}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-card-foreground">
                      {poll.question}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Created{" "}
                      {format(new Date(poll.created_at), "MMMM d, yyyy")}
                      {poll.total_votes !== undefined &&
                        ` • ${poll.total_votes} vote${poll.total_votes !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button
                        onClick={() => openInPersonVoteModal(poll)}
                        className="p-2 text-muted-foreground hover:text-primary"
                        title="Record in-person vote"
                      >
                        <UserCheck className="w-5 h-5" />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleDeletePoll(poll.id)}
                        className="p-2 text-muted-foreground hover:text-destructive"
                        title="Delete poll"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Voting Interface */}
                {!hasVoted && timeRemaining !== "Expired" && householdId ? (
                  <div className="space-y-3">
                    {poll.options.map((option) => (
                      <label
                        key={option}
                        className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedOptions[poll.id] === option
                            ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                            : "border-border hover:border-border"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`poll-${poll.id}`}
                          value={option}
                          checked={selectedOptions[poll.id] === option}
                          onChange={(e) =>
                            setSelectedOptions({
                              ...selectedOptions,
                              [poll.id]: e.target.value,
                            })
                          }
                          className="w-4 h-4 text-primary-600 border-border focus:ring-primary-500"
                        />
                        <span className="ml-3 text-card-foreground">
                          {option}
                        </span>
                      </label>
                    ))}
                    <button
                      onClick={() => handleVote(poll.id)}
                      disabled={!selectedOptions[poll.id]}
                      className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                        selectedOptions[poll.id]
                          ? "bg-primary-600 text-white hover:bg-primary-700"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      }`}
                    >
                      Submit Vote
                    </button>
                  </div>
                ) : (
                  /* Results Display */
                  <div className="space-y-3">
                    {poll.votes && poll.total_votes !== undefined ? (
                      <>
                        {poll.votes.map((vote) => {
                          const percentage = getVotePercentage(
                            vote.count,
                            poll.total_votes!,
                          );
                          return (
                            <div key={vote.option} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-card-foreground">
                                  {vote.option}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">
                                    {vote.count} votes
                                  </span>
                                  <span className="font-semibold text-primary-600">
                                    {percentage}%
                                  </span>
                                </div>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                <div
                                  className="bg-primary-600 h-full transition-all duration-300"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <BarChart className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground text-sm">
                          No votes yet. Be the first to vote!
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-card rounded-lg shadow p-12 text-center text-muted-foreground">
            <BarChart className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            No active polls found.
          </div>
        )}
      </div>

      {/* In-Person Vote Recording Modal */}
      {showInPersonVoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h3 className="text-lg font-semibold text-card-foreground">
                  Record In-Person Vote
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {showInPersonVoteModal.pollQuestion}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowInPersonVoteModal(null);
                  setError("");
                  setVoteSuccess("");
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-4 bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {voteSuccess && (
              <div className="mx-6 mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 p-3 rounded-lg text-sm">
                {voteSuccess}
              </div>
            )}

            <form onSubmit={handleRecordInPersonVote} className="p-6 space-y-4">
              {/* Homeowner Selection */}
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">
                  Homeowner *
                </label>
                <select
                  value={inPersonVoteForm.household_id}
                  onChange={(e) =>
                    setInPersonVoteForm({
                      ...inPersonVoteForm,
                      household_id: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                >
                  <option value="">Select homeowner</option>
                  {homeowners
                    .filter((h) => !votedHouseholds.has(h.id))
                    .map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.email}{" "}
                        {h.household_count
                          ? `(${h.household_count} lot${h.household_count > 1 ? "s" : ""})`
                          : "(1 lot)"}
                      </option>
                    ))}
                </select>
                {inPersonVoteForm.household_id && (
                  <p className="text-xs text-muted-foreground mt-1">
                    This vote will represent{" "}
                    {homeowners.find(
                      (h) => h.id === inPersonVoteForm.household_id,
                    )?.household_count || 1}{" "}
                    lot(s)
                  </p>
                )}
              </div>

              {/* Option Selection */}
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">
                  Selected Option *
                </label>
                <select
                  value={inPersonVoteForm.selected_option}
                  onChange={(e) =>
                    setInPersonVoteForm({
                      ...inPersonVoteForm,
                      selected_option: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                >
                  <option value="">Select option</option>
                  {showInPersonVoteModal.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* Vote Date/Time */}
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">
                  Voted At *
                </label>
                <input
                  type="datetime-local"
                  value={inPersonVoteForm.voted_at}
                  onChange={(e) =>
                    setInPersonVoteForm({
                      ...inPersonVoteForm,
                      voted_at: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
              </div>

              {/* Witness */}
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">
                  Witness
                </label>
                <input
                  type="text"
                  value={inPersonVoteForm.witness}
                  onChange={(e) =>
                    setInPersonVoteForm({
                      ...inPersonVoteForm,
                      witness: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Optional"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowInPersonVoteModal(null);
                    setError("");
                    setVoteSuccess("");
                  }}
                  className="flex-1 px-4 py-2 border border-border text-card-foreground rounded-lg hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Record Vote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
