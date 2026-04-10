export type IncidentCategory =
  | 'Communication'
  | 'Action / Change'
  | 'Process Event'
  | 'Pay / Benefits'
  | 'Working Conditions'
  | 'Observed Behaviour'
  | 'Record Issued'
  | 'Other';

export type IncidentSubtype = string;

export type IncidentSeverity = 'Low' | 'Moderate' | 'Serious' | 'Critical';

export type IncidentStatus = 'Open' | 'Followed Up' | 'Escalated' | 'Closed';

export type EvidenceType = 'Photo' | 'Screenshot' | 'Document' | 'Audio' | 'Email' | 'Other';

export type NoteType = 'Update' | 'Meeting' | 'Outcome' | 'Other';

export type ContextDomain = 'Workplace' | 'Education' | 'Home / Domestic' | 'Public / Social' | 'Online / Digital' | 'Other' | 'Unknown';

export interface Incident {
  incident_id: string;
  user_id: string;
  incident_date: string;
  incident_time?: string;
  location?: string;
  people_involved: string[];
  witnesses: string[];
  category?: IncidentCategory;
  subtype?: IncidentSubtype;
  severity?: IncidentSeverity;
  impact_note?: string;
  raw_narrative: string;
  ai_summary?: string;
  exact_words?: string;
  tags: string[];
  status: IncidentStatus;
  locked: boolean;
  excluded_from_rep: boolean;
  record_method?: 'voice' | 'text';
  created_at: string;
  updated_at: string;
  context_domain?: ContextDomain;
  category_source?: 'ai' | 'user';
  // Computed
  title?: string;
}

export interface EditHistoryEntry {
  history_id: string;
  incident_id: string;
  user_id: string;
  field_changed: string;
  old_value?: string;
  new_value?: string;
  changed_at: string;
}

export interface Evidence {
  file_id: string;
  user_id: string;
  incident_id?: string;
  file_name: string;
  file_type: EvidenceType;
  file_path: string;
  file_hash: string;
  mime_type: string;
  file_size?: number;
  upload_date: string;
  capture_date?: string;
  description?: string;
}

export interface FollowUpNote {
  note_id: string;
  incident_id: string;
  user_id: string;
  note_text: string;
  note_type: NoteType;
  created_at: string;
}

export interface RepAccessLink {
  link_id: string;
  user_id: string;
  token: string;
  rep_name?: string;
  rep_organisation?: string;
  excluded_ids: string[];
  created_at: string;
  expires_at: string;
  revoked: boolean;
  last_accessed?: string;
  access_count: number;
}

export interface RightsGuidance {
  id: string;
  incident_category: string;
  title: string;
  description?: string;
  url: string;
  source: string;
  active: boolean;
  display_order: number;
  updated_at: string;
}
