export type PdfDocument = {
  id: string;
  filename: string;
  key: string;
  size_bytes: number;
  uploaded_at: string | null;
  last_accessed_at: string | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
};

export type ActivityItem = {
  type: "upload" | "member";
  title: string;
  timestamp: string | null;
  actor: string | null;
  meta: Record<string, unknown>;
};

export type WorkspaceOverview = {
  stats: {
    total_documents: number;
    total_storage_bytes: number;
    active_members: number;
    verified_members: number;
    last_upload_at: string | null;
  };
  documents: PdfDocument[];
  activity: ActivityItem[];
};
