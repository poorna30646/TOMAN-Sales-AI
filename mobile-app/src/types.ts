export type TabKey =
  | 'Home'
  | 'Leads'
  | 'Jarvis'
  | 'Agents'
  | 'Campaigns'
  | 'Alerts'
  | 'Settings';

export type AppStage =
  | 'welcome'
  | 'register'
  | 'verifyEmail'
  | 'signIn'
  | 'businessSetup'
  | 'jarvisIntro'
  | 'workspace';

/**
 * A UI representation of a renewable server session.  It deliberately never
 * contains a permanent JWT.  The Auth service will later keep a short-lived
 * access token in memory and a rotating refresh session in secure storage.
 */
export interface UserSession {
  userId: string;
  workspaceId: string;
  ownerName: string;
  businessName: string;
  isDemo: boolean;
}

/** @deprecated Use UserSession. Kept temporarily while the gateway client is introduced. */
export type DemoSession = UserSession;

export interface RegistrationForm {
  fullName: string;
  businessName: string;
  email: string;
  mobile: string;
  password: string;
  industry: string;
  goal: string;
}

export type AgentRole =
  | 'Jarvis Orchestrator'
  | 'Growth Strategist'
  | 'Creative Studio'
  | 'Video & Image Lab'
  | 'Campaign Operations'
  | 'Publisher & Insights'
  | 'Outreach Assistant';

export type AgentRunStatus =
  | 'Planning'
  | 'Creating'
  | 'Awaiting owner review'
  | 'Approved'
  | 'Scheduled'
  | 'Publishing'
  | 'Complete';

export interface SalesAgent {
  id: string;
  name: string;
  role: AgentRole;
  summary: string;
  icon: string;
  color: string;
  status: 'Ready' | 'Working' | 'Waiting for review';
  currentTask: string;
}

export interface AgentRun {
  id: string;
  title: string;
  prompt: string;
  status: AgentRunStatus;
  assignedAgentIds: string[];
  createdBy: 'Jarvis' | 'Owner';
  output: string;
  createdAt: string;
}

export type IntegrationProvider =
  | 'Email'
  | 'WhatsApp'
  | 'Facebook'
  | 'Instagram'
  | 'Google Ads'
  | 'YouTube';

export interface Integration {
  id: string;
  provider: IntegrationProvider;
  icon: string;
  color: string;
  status: 'Not connected' | 'Sandbox connected' | 'Needs re-authentication';
  capability: string;
  account?: string;
}

export type LeadStage = 'Hot' | 'Interested' | 'Follow-up' | 'New';

export type CampaignStatus =
  | 'Needs approval'
  | 'Draft'
  | 'Scheduled'
  | 'Live'
  | 'Completed';

export interface Lead {
  id: string;
  name: string;
  company: string;
  initials: string;
  score: number;
  stage: LeadStage;
  intent: string;
  action: string;
  phone: string;
  email: string;
  consent: 'Email + WhatsApp approved' | 'Email approved' | 'Needs consent';
  value: string;
  lastContact: string;
  summary: string;
}

export interface Campaign {
  id: string;
  title: string;
  status: CampaignStatus;
  audience: string;
  channel: string;
  expectedOutcome: string;
  scheduledFor: string;
  description: string;
  message: string;
  why: string;
  progress: string;
  color: string;
}

export interface AlertItem {
  id: string;
  title: string;
  detail: string;
  time: string;
  kind:
    | 'reply'
    | 'campaign'
    | 'insight'
    | 'approval'
    | 'review'
    | 'permission'
    | 'completed'
    | 'lead';
  unread?: boolean;
}

/**
 * File metadata retained by the mobile client until the Ingestion service
 * acknowledges it. The file itself is never parsed or persisted in the UI.
 */
export interface SelectedBusinessDocument {
  id: string;
  name: string;
  uri: string;
  mimeType: string | null;
  size: number | null;
  category: 'Customer sheet' | 'Business document';
  status: 'Selected locally' | 'Queued for secure upload' | 'Uploaded' | 'Upload failed';
  isDemoSample?: boolean;
}

export interface NotificationPreferences {
  reviews: boolean;
  permissions: boolean;
  completedTasks: boolean;
  newLeads: boolean;
}

export interface WorkspaceMetrics {
  revenue: string;
  revenueHelper: string;
  qualifiedLeads: string;
  qualifiedHelper: string;
  replies: string;
  repliesHelper: string;
  meetings: string;
  meetingsHelper: string;
  roi: string;
  roiHelper: string;
}
