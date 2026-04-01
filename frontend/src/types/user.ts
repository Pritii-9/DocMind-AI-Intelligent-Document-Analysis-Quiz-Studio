export type WorkspaceUser = {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  verified: boolean;
  is_active: boolean;
  workspace_owner?: string;
  invited_by?: string;
  created_at?: string;
};
