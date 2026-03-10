import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Users, Plus, Pencil, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  BoardMember,
  CreateBoardMemberInput,
  UpdateBoardMemberInput,
} from "@/types";

interface BoardMembersTabProps {
  amenityTypes: string[];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _amenityTypes?: string[];
}

const positionLabels: Record<string, string> = {
  president: "President",
  vice_president: "Vice President",
  secretary: "Secretary",
  treasurer: "Treasurer",
  auditor: "Auditor",
  member: "Member",
};

const activePositions = [
  "president",
  "vice_president",
  "secretary",
  "treasurer",
  "auditor",
  "member",
];

interface FormData {
  user_id: string;
  user_email: string;
  position: string;
  term_start: string;
  term_end: string;
  notes: string;
}

const emptyForm: FormData = {
  user_id: "",
  user_email: "",
  position: "",
  term_start: "",
  term_end: "",
  notes: "",
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function BoardMembersTab({
  amenityTypes: _amenityTypes,
}: BoardMembersTabProps) {
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<BoardMember | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [userSuggestions, setUserSuggestions] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<BoardMember | null>(
    null,
  );

  useEffect(() => {
    loadBoardMembers();
  }, []);

  const loadBoardMembers = async () => {
    try {
      setIsLoading(true);
      const hoa_token = localStorage.getItem("hoa_token");

      const response = await fetch("/api/admin/board-members", {
        headers: {
          Authorization: `Bearer ${hoa_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load board members");
      }

      const data = await response.json();
      setBoardMembers(data.board_members || []);
    } catch (error) {
      console.error("Error loading board members:", error);
      toast.error("Failed to load board members");
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserSuggestions = async (email: string) => {
    if (!email || email.length < 2) {
      setUserSuggestions([]);
      return;
    }

    try {
      setIsLoadingUsers(true);
      const hoa_token = localStorage.getItem("hoa_token");

      const response = await fetch(`/api/admin/users?search=${email}`, {
        headers: {
          Authorization: `Bearer ${hoa_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to search users");
      }

      const data = await response.json();
      setUserSuggestions(data.users || []);
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      loadUserSuggestions(searchEmail);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchEmail]);

  const openCreateDialog = () => {
    setEditingMember(null);
    setFormData(emptyForm);
    setSearchEmail("");
    setUserSuggestions([]);
    setIsDialogOpen(true);
  };

  const openEditDialog = (member: BoardMember) => {
    setEditingMember(member);
    setFormData({
      user_id: member.user_id,
      user_email: member.user_email,
      position: member.position || "",
      term_start: member.term_start,
      term_end: member.term_end,
      notes: member.notes || "",
    });
    setSearchEmail(member.user_email);
    setUserSuggestions([]);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingMember(null);
    setFormData(emptyForm);
    setSearchEmail("");
    setUserSuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.user_id) {
      toast.error("Please select a user");
      return;
    }

    if (!formData.term_start || !formData.term_end) {
      toast.error("Term dates are required");
      return;
    }

    try {
      setIsSubmitting(true);
      const hoa_token = localStorage.getItem("hoa_token");

      if (editingMember) {
        // Update
        const input: UpdateBoardMemberInput = {
          position: formData.position || undefined,
          term_start: formData.term_start,
          term_end: formData.term_end,
          notes: formData.notes || undefined,
        };

        const response = await fetch(
          `/api/admin/board-members/${editingMember.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${hoa_token}`,
            },
            body: JSON.stringify(input),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to update board member");
        }
      } else {
        // Create
        const input: CreateBoardMemberInput = {
          user_id: formData.user_id,
          position: formData.position || undefined,
          term_start: formData.term_start,
          term_end: formData.term_end,
          notes: formData.notes || undefined,
        };

        const response = await fetch("/api/admin/board-members", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${hoa_token}`,
          },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create board member");
        }
      }

      await loadBoardMembers();
      closeDialog();
      toast.success(
        editingMember ? "Board member updated" : "Board member added",
      );
    } catch (error: any) {
      console.error("Error saving board member:", error);
      toast.error(error.message || "Failed to save board member");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResign = async (member: BoardMember) => {
    const resignationReason = prompt("Enter resignation reason (optional):");

    try {
      const hoa_token = localStorage.getItem("hoa_token");

      const response = await fetch(`/api/admin/board-members/${member.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${hoa_token}`,
        },
        body: JSON.stringify({
          resigned_at: new Date().toISOString(),
          resignation_reason: resignationReason || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to resign board member");
      }

      await loadBoardMembers();
      toast.success("Board member resigned");
    } catch (error) {
      console.error("Error resigning board member:", error);
      toast.error("Failed to resign board member");
    }
  };

  const openDeleteDialog = (member: BoardMember) => {
    setMemberToDelete(member);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setMemberToDelete(null);
  };

  const handleDelete = async () => {
    if (!memberToDelete) return;

    try {
      const hoa_token = localStorage.getItem("hoa_token");

      const response = await fetch(
        `/api/admin/board-members/${memberToDelete.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${hoa_token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete board member");
      }

      await loadBoardMembers();
      closeDeleteDialog();
      toast.success("Board member deleted");
    } catch (error) {
      console.error("Error deleting board member:", error);
      toast.error("Failed to delete board member");
    }
  };

  const selectUser = (user: any) => {
    setFormData((prev) => ({
      ...prev,
      user_id: user.id,
      user_email: user.email,
    }));
    setSearchEmail(user.email);
    setUserSuggestions([]);
  };

  const updateForm = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isResigned = (member: BoardMember) => !!member.resigned_at;
  const isActive = (member: BoardMember) =>
    !member.resigned_at && new Date(member.term_end) >= new Date();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="mx-auto mb-4 w-8 h-8 rounded-full border-b-2 animate-spin border-primary" />
          <p className="text-sm text-muted-foreground">
            Loading board members...
          </p>
        </div>
      </div>
    );
  }

  const activeMembers = boardMembers.filter(isActive);
  const resignedMembers = boardMembers.filter(isResigned);
  const expiredMembers = boardMembers.filter(
    (m) => !isActive(m) && !isResigned(m),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Board Members</h2>
          <p className="text-muted-foreground">
            Manage HOA board members and term tracking
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 w-4 h-4" />
          Add Board Member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Active Members</p>
              <p className="text-2xl font-bold">{activeMembers.length}</p>
            </div>
            <Users className="w-8 h-8 text-green-500 opacity-50" />
          </div>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Resigned</p>
              <p className="text-2xl font-bold">{resignedMembers.length}</p>
            </div>
            <X className="w-8 h-8 text-red-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Active Board Members */}
      {activeMembers.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b bg-muted/30">
            <h3 className="font-semibold">Active Board Members</h3>
          </div>
          <div className="divide-y">
            {activeMembers.map((member) => (
              <div
                key={member.id}
                className="flex justify-between items-center p-4 hover:bg-muted/30"
              >
                <div className="flex gap-4 items-center">
                  <div className="flex gap-2 items-center">
                    <Users className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{member.user_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {member.user_email}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    {member.position && (
                      <Badge variant="outline">
                        {positionLabels[member.position] || member.position}
                      </Badge>
                    )}
                    <Badge variant="secondary">
                      {member.free_bookings_remaining || 0} free booking remaining
                    </Badge>
                    {(member.bookings_this_year || 0) > 0 && (
                      <Badge
                        variant="outline"
                        className="text-blue-600 border-blue-200"
                      >
                        {member.bookings_this_year} free used
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditDialog(member)}
                    aria-label="Edit board member"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleResign(member)}
                    aria-label="Resign board member"
                  >
                    <X className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resigned/Expired Members */}
      {(resignedMembers.length > 0 || expiredMembers.length > 0) && (
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b bg-muted/30">
            <h3 className="font-semibold">Former Board Members</h3>
          </div>
          <div className="divide-y">
            {[...resignedMembers, ...expiredMembers].map((member) => (
              <div
                key={member.id}
                className="flex justify-between items-center p-4 opacity-60 hover:bg-muted/30"
              >
                <div className="flex gap-4 items-center">
                  <div className="flex gap-2 items-center">
                    <Users className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{member.user_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {member.user_email}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    {member.position && (
                      <Badge variant="outline">
                        {positionLabels[member.position] || member.position}
                      </Badge>
                    )}
                    {member.resigned_at && (
                      <Badge variant="destructive">Resigned</Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditDialog(member)}
                    aria-label="Edit board member"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openDeleteDialog(member)}
                    aria-label="Delete board member"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {boardMembers.length === 0 && (
        <div className="flex flex-col justify-center items-center py-12 text-center">
          <Users className="mb-4 w-12 h-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No board members</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Add board members to track their terms and free booking benefits.
          </p>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMember ? "Edit Board Member" : "Add Board Member"}
            </DialogTitle>
            <DialogDescription>
              {editingMember
                ? "Update board member information."
                : "Add a new board member to track their term and benefits."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user_email">User *</Label>
                <div className="relative">
                  <Input
                    id="user_email"
                    type="email"
                    placeholder="Search by email..."
                    value={searchEmail}
                    onChange={(e) => {
                      setSearchEmail(e.target.value);
                      if (!editingMember) {
                        setFormData((prev) => ({ ...prev, user_id: "" }));
                      }
                    }}
                    disabled={!!editingMember}
                  />
                  {isLoadingUsers && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 rounded-full border-b-2 animate-spin border-primary" />
                    </div>
                  )}
                </div>
                {!editingMember && userSuggestions.length > 0 && (
                  <div className="overflow-auto mt-1 max-h-48 rounded-md border bg-popover">
                    {userSuggestions.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => selectUser(user)}
                        className="flex justify-between items-center px-3 py-2 w-full text-left hover:bg-muted/50"
                      >
                        <div>
                          <p className="text-sm font-medium">{user.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {user.first_name} {user.last_name}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <Select
                  value={formData.position}
                  onValueChange={(v) => updateForm("position", v)}
                >
                  <SelectTrigger id="position">
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    {activePositions.map((pos) => (
                      <SelectItem key={pos} value={pos}>
                        {positionLabels[pos]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="term_start">Term Start *</Label>
                  <Input
                    id="term_start"
                    type="date"
                    value={formData.term_start}
                    onChange={(e) => updateForm("term_start", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="term_end">Term End *</Label>
                  <Input
                    id="term_end"
                    type="date"
                    value={formData.term_end}
                    onChange={(e) => updateForm("term_end", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  placeholder="Additional notes..."
                  value={formData.notes}
                  onChange={(e) => updateForm("notes", e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : editingMember ? "Update" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Board Member?</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this board member
              record? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {memberToDelete && (
            <div className="p-3 space-y-1 rounded-lg bg-muted/50">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{memberToDelete.user_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{memberToDelete.user_email}</span>
              </div>
              {memberToDelete.position && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Position:</span>
                  <span className="font-medium">
                    {positionLabels[memberToDelete.position] ||
                      memberToDelete.position}
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDeleteDialog}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
