export interface AdminLot {
  id: string;
  block: string;
  lot: string;
  address: string;
  lot_type:
    | "residential"
    | "resort"
    | "commercial"
    | "community"
    | "utility"
    | "open_space";
  lot_status: "built" | "vacant_lot" | "under_construction";
  ownership_status: "owned" | "pending" | "unowned";
  primaryOwner?: {
    id: string;
    name: string;
    email: string;
  };
  memberCount: number;
}

export interface LotMemberDetail {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  member_type: "primary_owner" | "secondary";
  can_vote: boolean;
  verified: boolean;
  verified_at?: string;
  notes?: string;
}

export interface UnassignedLot {
  id: string;
  block: string;
  lot: string;
  address: string;
  lot_type: string;
  lot_status: string;
}

export interface AssignMemberForm {
  household_id: string;
  user_id: string;
  user_email: string;
  member_type: "primary_owner" | "secondary";
  notes?: string;
}
