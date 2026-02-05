import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api, CreatePollInput } from "@/lib/api";
import {
  format,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
} from "date-fns";
import {
  PlusIcon,
  TrashIcon,
  ChartBarIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

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

  const isAdmin = user?.role === "admin";
  // For demo purposes, use user ID as household ID
  // In production, this would come from user's household association
  const householdId = user?.id || "demo-household";

  useEffect(() => {
    loadPolls();
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
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Community Polls</h1>
        {isAdmin && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <PlusIcon className="w-5 h-5" />
            New Poll
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreateForm && isAdmin && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Create New Poll</h2>
          <form onSubmit={handleCreatePoll} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question
              </label>
              <input
                type="text"
                name="question"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                placeholder="What would you like to ask the community?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Options (minimum 2)
              </label>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <input
                    key={i}
                    type="text"
                    name={`option${i}`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    placeholder={`Option ${i}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ends At
              </label>
              <input
                type="datetime-local"
                name="ends_at"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
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
              <div key={poll.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {hasVoted && (
                        <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                          <CheckCircleIcon className="w-3 h-3" />
                          Voted
                        </span>
                      )}
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          timeRemaining === "Expired"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {timeRemaining}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {poll.question}
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Created{" "}
                      {format(new Date(poll.created_at), "MMMM d, yyyy")}
                      {poll.total_votes !== undefined &&
                        ` • ${poll.total_votes} vote${poll.total_votes !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleDeletePoll(poll.id)}
                      className="ml-4 p-2 text-gray-400 hover:text-red-600"
                      title="Delete poll"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {/* Voting Interface */}
                {!hasVoted && timeRemaining !== "Expired" && householdId ? (
                  <div className="space-y-3">
                    {poll.options.map((option) => (
                      <label
                        key={option}
                        className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedOptions[poll.id] === option
                            ? "border-primary-500 bg-primary-50"
                            : "border-gray-200 hover:border-gray-300"
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
                          className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                        />
                        <span className="ml-3 text-gray-700">{option}</span>
                      </label>
                    ))}
                    <button
                      onClick={() => handleVote(poll.id)}
                      disabled={!selectedOptions[poll.id]}
                      className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                        selectedOptions[poll.id]
                          ? "bg-primary-600 text-white hover:bg-primary-700"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
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
                                <span className="font-medium text-gray-700">
                                  {vote.option}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500">
                                    {vote.count} votes
                                  </span>
                                  <span className="font-semibold text-primary-600">
                                    {percentage}%
                                  </span>
                                </div>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
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
                        <ChartBarIcon className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                        <p className="text-gray-500 text-sm">
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
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
            <ChartBarIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            No active polls found.
          </div>
        )}
      </div>
    </div>
  );
}
