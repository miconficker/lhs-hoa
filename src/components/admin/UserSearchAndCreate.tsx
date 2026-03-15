import { useState, useEffect } from "react";
import { Search, UserPlus, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UserSearchResult } from "@/types";

interface UserSearchAndCreateProps {
  value: {
    type: "resident" | "guest" | "new_resident" | "new_guest";
    user_id?: string;
    customer_id?: string;
    new_customer?: {
      first_name: string;
      last_name: string;
      email: string;
      phone?: string;
    };
  } | null;
  onChange: (value: UserSearchAndCreateProps["value"]) => void;
  onError?: (error: string) => void;
}

export function UserSearchAndCreate({
  value,
  onChange,
  onError,
}: UserSearchAndCreateProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showNewGuestDialog, setShowNewGuestDialog] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  // Search for users when query changes (debounced)
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await api.admin.searchUsers(searchQuery);
        if (result.error) {
          onError?.(result.error);
        } else {
          // Parse the response - admin.searchUsers returns { users: Array }
          // Map users to UserSearchResult format by adding 'type' property
          const users = (result.data?.users || []).map((u: any) => ({
            ...u,
            type:
              u.role === "admin" || u.role === "staff"
                ? "resident"
                : ("resident" as const),
          }));
          setSearchResults(users);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    setSearchTimeout(timeout);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleSelectUser = (result: UserSearchResult) => {
    setSearchQuery("");
    setSearchResults([]);
    onChange({
      type: result.type,
      user_id: result.type === "resident" ? result.id : undefined,
      customer_id: result.type === "guest" ? result.id : undefined,
    });
  };

  const handleCreateNewGuest = () => {
    setShowNewGuestDialog(true);
  };

  const selectedDisplay = value ? (
    value.type === "new_guest" || value.type === "new_resident" ? (
      <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border">
        <UserPlus className="w-4 h-4 text-primary" />
        <span className="font-medium">
          New {value.type === "new_guest" ? "Guest" : "Resident"}:{" "}
          {value.new_customer?.first_name} {value.new_customer?.last_name}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => onChange(null)}
        >
          Change
        </Button>
      </div>
    ) : (
      <div className="flex items-center gap-2 p-2 rounded-md bg-muted">
        <Users className="w-4 h-4" />
        <span className="font-medium">
          {value.type === "resident" ? "Resident" : "Guest"} ID:{" "}
          {value.user_id || value.customer_id?.slice(0, 8)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => onChange(null)}
        >
          Change
        </Button>
      </div>
    )
  ) : null;

  return (
    <div className="space-y-3">
      <Label>Customer</Label>

      {!value ? (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="border rounded-md bg-background max-h-64 overflow-y-auto">
              {/* Residents Group */}
              {searchResults.filter(
                (r: any) =>
                  r.role === "resident" || (r as any).type === "resident",
              ).length > 0 && (
                <div className="p-2">
                  <p className="text-xs font-medium text-muted-foreground px-2 mb-1">
                    Residents
                  </p>
                  {searchResults
                    .filter(
                      (r: any) =>
                        r.role === "resident" || (r as any).type === "resident",
                    )
                    .map((result: any) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() =>
                          handleSelectUser({ ...result, type: "resident" })
                        }
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
                      >
                        <p className="font-medium">
                          {result.first_name} {result.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {result.email}
                        </p>
                        {(result as any).household_address && (
                          <p className="text-xs text-muted-foreground">
                            {(result as any).household_address}
                          </p>
                        )}
                      </button>
                    ))}
                </div>
              )}

              {/* Guests Group - For now, we'll show new guest option */}
              <div className="p-2 border-t">
                <p className="text-xs font-medium text-muted-foreground px-2 mb-1">
                  Quick Actions
                </p>
                <button
                  type="button"
                  onClick={handleCreateNewGuest}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors text-primary"
                >
                  <p className="font-medium flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Create New Guest
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleCreateNewGuest}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              New Guest
            </Button>
          </div>

          {/* New Guest Dialog */}
          <NewGuestDialog
            open={showNewGuestDialog}
            onOpenChange={setShowNewGuestDialog}
            onSelect={(guestData) => {
              onChange({
                type: "new_guest",
                new_customer: guestData,
              });
              setShowNewGuestDialog(false);
            }}
          />
        </>
      ) : (
        selectedDisplay
      )}
    </div>
  );
}

interface NewGuestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (guest: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  }) => void;
}

function NewGuestDialog({ open, onOpenChange, onSelect }: NewGuestDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email) return;
    onSelect({ first_name: firstName, last_name: lastName, email, phone });
    // Reset form
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Guest Customer</DialogTitle>
          <DialogDescription>
            Add a new external guest customer. They will be able to view their
            booking status.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Create Guest</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
