import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { PreApprovedEmail, UserRole } from "@/types";

export function WhitelistManagementPage() {
  const [entries, setEntries] = useState<PreApprovedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("resident");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    setLoading(true);
    const result = await api.auth.whitelist.list();
    if (result.data?.entries) {
      setEntries(result.data.entries);
    } else if (result.error) {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const result = await api.auth.whitelist.add({
      email: newEmail,
      role: newRole,
    });

    if (result.data?.entry) {
      setEntries([result.data.entry, ...entries]);
      setNewEmail("");
      setNewRole("resident");
      setShowAddForm(false);
    } else if (result.error) {
      setError(result.error);
    }
    setSubmitting(false);
  };

  const handleRemove = async (id: string) => {
    if (
      !confirm("Are you sure you want to remove this email from the whitelist?")
    ) {
      return;
    }

    const result = await api.auth.whitelist.remove(id);
    if (result.data?.success) {
      setEntries(entries.filter((e) => e.id !== id));
    } else if (result.error) {
      setError(result.error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-800";
      case "resident":
        return "bg-green-100 text-green-800";
      case "staff":
        return "bg-blue-100 text-blue-800";
      case "guest":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-card-foreground">Email Whitelist</h1>
          <p className="text-muted-foreground mt-1">
            Manage pre-approved emails for Google OAuth sign-in
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          {showAddForm ? "Cancel" : "Add Email"}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
          {error}
        </div>
      )}

      {showAddForm && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-medium text-card-foreground mb-4">
            Add Email to Whitelist
          </h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                placeholder="resident@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">
                Role
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="resident">Resident</option>
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
                <option value="guest">Guest</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400"
              >
                {submitting ? "Adding..." : "Add to Whitelist"}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Invited
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Accepted
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-4 text-center text-muted-foreground"
                  >
                    Loading...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-4 text-center text-muted-foreground"
                  >
                    No emails in whitelist. Add one to get started.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-card-foreground">
                        {entry.email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(
                          entry.role,
                        )}`}
                      >
                        {entry.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {entry.is_active ? (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-muted-foreground">
                        {formatDate(entry.invited_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {entry.accepted_at ? (
                        <div className="text-sm text-muted-foreground">
                          {formatDate(entry.accepted_at)}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">
                          Not yet
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRemove(entry.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">How it works</h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Add resident emails to the whitelist above</li>
          <li>Residents click "Sign in with Google" on the login page</li>
          <li>Their email is verified against the whitelist</li>
          <li>
            If approved, they're logged in automatically (no password needed)
          </li>
        </ol>
      </div>
    </div>
  );
}
