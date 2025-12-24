import { pgTable, text, serial, integer, boolean, timestamp, jsonb, pgEnum, uuid, numeric, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'LAWYER', 'ASSISTANT']);
export const aiProviderEnum = pgEnum('ai_provider', ['OPENAI', 'GEMINI', 'NONE']);
export const invitationStatusEnum = pgEnum('invitation_status', ['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED']);
export const notificationStatusEnum = pgEnum('notification_status', [
  'EXTRACTED', 'TRIAGE_REQUIRED', 'TRIAGED', 
  'PLAN_DRAFTED', 'PLAN_APPROVED', 
  'EXECUTED', 'EXECUTION_FAILED', 'CANCELLED_MANUAL'
]);
export const priorityEnum = pgEnum('priority', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export const agentStatusEnum = pgEnum('agent_status', ['ONLINE', 'OFFLINE', 'ERROR']);

export const packageStatusEnum = pgEnum('package_status', ['RECEIVED', 'INCOMPLETE', 'READY_FOR_ANALYSIS', 'ANALYZED', 'ARCHIVED', 'FAILED']);
export const packageSourceEnum = pgEnum('package_source', ['AGENT', 'MANUAL_UPLOAD']);
export const executionPlanStatusEnum = pgEnum('execution_plan_status', ['DRAFT', 'PROPOSED', 'IN_REVIEW', 'APPROVED', 'EXECUTED', 'CANCELLED', 'ERROR']);
export const actionTypeEnum = pgEnum('action_type', ['UPLOAD_INVENTO', 'CREATE_NOTE', 'CREATE_EVENT', 'SEND_EMAIL_LAWYER', 'SEND_EMAIL_CLIENT', 'REQUEST_POWER', 'DOWNLOAD_LINK', 'DETECT_COLLISION']);
export const actionStatusEnum = pgEnum('action_status', ['PROPOSED', 'EDITED', 'PENDING', 'APPROVED', 'EXECUTED', 'SKIPPED', 'FAILED']);
export const externalDownloadStatusEnum = pgEnum('external_download_status', ['PENDING', 'DOWNLOADING', 'COMPLETED', 'FAILED', 'ATTACHED']);

export const offices = pgTable("offices", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  timezone: text("timezone").default('Europe/Madrid'),
  commonCalendarId: text("common_calendar_id"),
  teamsChannelId: text("teams_channel_id"),
  genericEmail: text("generic_email"),
  joinCode: text("join_code").unique(),
  aiProvider: aiProviderEnum("ai_provider").default('NONE'),
  aiSecretKeyName: text("ai_secret_key_name"),
  aiModelPreferences: jsonb("ai_model_preferences"),
  aiTemperature: numeric("ai_temperature", { precision: 3, scale: 2 }).default("0.7"),
  inventoApiUrl: text("invento_api_url"),
  inventoSecretKeyName: text("invento_secret_key_name"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  officeId: integer("office_id").references(() => offices.id),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  outlookCategoryName: text("outlook_category_name"),
  outlookColor: text("outlook_color"),
  emailHighlightColor: text("email_highlight_color"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: userRoleEnum("role").notNull().default('ASSISTANT'),
  officeId: integer("office_id").references(() => offices.id),
  teamId: integer("team_id").references(() => teams.id),
  categoryId: integer("category_id").references(() => categories.id),
  tutorUserId: integer("tutor_user_id"),
  teamsUserId: text("teams_user_id"),
  useAi: boolean("use_ai").default(true),
  isActive: boolean("is_active").notNull().default(true),
  isPendingApproval: boolean("is_pending_approval").default(false),
  approvedBy: integer("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userInvitations = pgTable("user_invitations", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  officeId: integer("office_id").references(() => offices.id).notNull(),
  teamId: integer("team_id").references(() => teams.id),
  role: userRoleEnum("role").notNull().default('ASSISTANT'),
  inviteCode: text("invite_code").notNull().unique(),
  status: invitationStatusEnum("status").notNull().default('PENDING'),
  invitedBy: integer("invited_by").references(() => users.id).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedBy: integer("accepted_by").references(() => users.id),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const lexnetAccounts = pgTable("lexnet_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  accessMethod: text("access_method").notNull(),
  certificateThumbprint: text("certificate_thumbprint"),
  status: text("status").default('ACTIVE'),
  lastSuccessfulLogin: timestamp("last_successful_login"),
  lastDownload: timestamp("last_download"),
  agentId: integer("agent_id").references(() => agents.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userAiSettings = pgTable("user_ai_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  provider: aiProviderEnum("provider").notNull().default('GEMINI'),
  apiKey: text("api_key"),
  modelPreferences: jsonb("model_preferences"),
  temperature: numeric("temperature", { precision: 3, scale: 2 }).default("0.7"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const lexnetPackages = pgTable("lexnet_packages", {
  id: serial("id").primaryKey(),
  packageId: text("package_id").notNull().unique(),
  lawyerId: integer("lawyer_id").references(() => users.id).notNull(),
  agentId: integer("agent_id").references(() => agents.id),
  source: packageSourceEnum("source").notNull().default('AGENT'),
  lexnetIds: jsonb("lexnet_ids"),
  downloadDate: timestamp("download_date").notNull(),
  status: packageStatusEnum("status").notNull().default('RECEIVED'),
  zipPath: text("zip_path"),
  zipHash: text("zip_hash"),
  receiptPath: text("receipt_path"),
  receiptHash: text("receipt_hash"),
  hasReceipt: boolean("has_receipt").default(false),
  extractedPath: text("extracted_path"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  packageId: integer("package_id").references(() => lexnetPackages.id),
  notificationId: integer("notification_id").references(() => notifications.id),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  renamedName: text("renamed_name"),
  filePath: text("file_path").notNull(),
  fileHash: text("file_hash"),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  isPrimary: boolean("is_primary").default(false),
  isReceipt: boolean("is_receipt").default(false),
  extractedText: text("extracted_text"),
  requiresOcr: boolean("requires_ocr").default(false),
  sequenceNumber: integer("sequence_number"),
  groupKey: text("group_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  lexnetId: text("lexnet_id").notNull(),
  packageId: integer("package_id").references(() => lexnetPackages.id),
  receivedDate: timestamp("received_date").notNull(),
  downloadedDate: timestamp("downloaded_date"),
  court: text("court").notNull(),
  location: text("location"),
  procedureType: text("procedure_type"),
  procedureNumber: text("procedure_number").notNull(),
  actType: text("act_type"),
  parties: jsonb("parties"),
  status: notificationStatusEnum("status").notNull().default('EXTRACTED'),
  priority: priorityEnum("priority").notNull().default('MEDIUM'),
  docType: text("doc_type"),
  aiConfidence: integer("ai_confidence"),
  aiReasoning: jsonb("ai_reasoning"),
  aiEvidences: jsonb("ai_evidences"),
  extractedDeadlines: jsonb("extracted_deadlines"),
  extractedDates: jsonb("extracted_dates"),
  suggestedCaseId: text("suggested_case_id"),
  suggestedCaseConfidence: integer("suggested_case_confidence"),
  assignedLawyerId: integer("assigned_lawyer_id").references(() => users.id),
  inventoCaseId: text("invento_case_id"),
  inventoInstance: text("invento_instance"),
  inventoFolder: text("invento_folder"),
  hasZip: boolean("has_zip").default(false),
  hasReceipt: boolean("has_receipt").default(false),
  triageAssignedTo: integer("triage_assigned_to").references(() => users.id),
  triageResolvedBy: integer("triage_resolved_by").references(() => users.id),
  triageResolvedAt: timestamp("triage_resolved_at"),
  rawPayload: jsonb("raw_payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const executionPlans = pgTable("execution_plans", {
  id: serial("id").primaryKey(),
  notificationId: integer("notification_id").references(() => notifications.id).notNull(),
  status: executionPlanStatusEnum("status").notNull().default('DRAFT'),
  proposedBy: text("proposed_by").default('AI'),
  proposedAt: timestamp("proposed_at").defaultNow(),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  executedAt: timestamp("executed_at"),
  cancelledBy: integer("cancelled_by").references(() => users.id),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  inventoConfig: jsonb("invento_config"),
  outlookConfig: jsonb("outlook_config"),
  emailConfig: jsonb("email_config"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const executionActions = pgTable("execution_actions", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").references(() => executionPlans.id).notNull(),
  actionType: actionTypeEnum("action_type").notNull(),
  actionOrder: integer("action_order").notNull(),
  status: actionStatusEnum("status").notNull().default('PENDING'),
  title: text("title").notNull(),
  description: text("description"),
  config: jsonb("config"),
  previewData: jsonb("preview_data"),
  executionResult: jsonb("execution_result"),
  errorMessage: text("error_message"),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const caseMatches = pgTable("case_matches", {
  id: serial("id").primaryKey(),
  notificationId: integer("notification_id").references(() => notifications.id).notNull(),
  inventoCaseId: text("invento_case_id").notNull(),
  inventoCaseName: text("invento_case_name"),
  inventoInstance: text("invento_instance"),
  inventoFolder: text("invento_folder"),
  confidence: integer("confidence").default(0),
  matchReason: text("match_reason"),
  isConfirmed: boolean("is_confirmed").default(false),
  confirmedBy: integer("confirmed_by").references(() => users.id),
  confirmedAt: timestamp("confirmed_at"),
  isNewCase: boolean("is_new_case").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const externalDownloads = pgTable("external_downloads", {
  id: serial("id").primaryKey(),
  notificationId: integer("notification_id").references(() => notifications.id).notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceType: text("source_type"),
  fileName: text("file_name"),
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  status: externalDownloadStatusEnum("status").notNull().default('PENDING'),
  downloadedAt: timestamp("downloaded_at"),
  attachedToInventoAt: timestamp("attached_to_invento_at"),
  inventoDocumentId: text("invento_document_id"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const holidays = pgTable("holidays", {
  id: serial("id").primaryKey(),
  officeId: integer("office_id").references(() => offices.id),
  date: date("date").notNull(),
  name: text("name").notNull(),
  isNational: boolean("is_national").default(false),
  region: text("region"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const deadlineRules = pgTable("deadline_rules", {
  id: serial("id").primaryKey(),
  procedureType: text("procedure_type").notNull(),
  actType: text("act_type"),
  deadlineDays: integer("deadline_days").notNull(),
  isBusinessDays: boolean("is_business_days").default(true),
  augustExempt: boolean("august_exempt").default(false),
  description: text("description"),
  derivedEvents: jsonb("derived_events"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  purpose: text("purpose"),
  subjectTemplate: text("subject_template").notNull(),
  bodyTemplate: text("body_template").notNull(),
  isHtml: boolean("is_html").default(true),
  variables: jsonb("variables"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const eventTemplates = pgTable("event_templates", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  eventType: text("event_type").notNull(),
  titleTemplate: text("title_template").notNull(),
  isAllDay: boolean("is_all_day").default(false),
  durationMinutes: integer("duration_minutes"),
  reminderMinutes: integer("reminder_minutes"),
  variables: jsonb("variables"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rejectedItems = pgTable("rejected_items", {
  id: serial("id").primaryKey(),
  lawyerId: integer("lawyer_id").references(() => users.id).notNull(),
  lexnetId: text("lexnet_id"),
  rejectionReason: text("rejection_reason"),
  rejectionCode: text("rejection_code"),
  detectedAt: timestamp("detected_at").notNull(),
  status: text("status").default('DETECTED'),
  retryCount: integer("retry_count").default(0),
  lastRetryAt: timestamp("last_retry_at"),
  resolvedBy: integer("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull().unique(),
  name: text("name").notNull(),
  officeId: integer("office_id").references(() => offices.id),
  status: agentStatusEnum("status").notNull().default('OFFLINE'),
  lastHeartbeat: timestamp("last_heartbeat"),
  hostInfo: jsonb("host_info"),
  certificateThumbprint: text("certificate_thumbprint"),
  pollingIntervalSeconds: integer("polling_interval_seconds").default(30),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentLogs = pgTable("agent_logs", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  level: text("level").notNull(),
  message: text("message").notNull(),
  context: jsonb("context"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorUserId: integer("actor_user_id").references(() => users.id),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  metadata: jsonb("metadata"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const integrationTokens = pgTable("integration_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  provider: text("provider").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  scopes: text("scopes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const officesRelations = relations(offices, ({ many }) => ({
  teams: many(teams),
  users: many(users),
  agents: many(agents),
  holidays: many(holidays),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  office: one(offices, {
    fields: [teams.officeId],
    references: [offices.id],
  }),
  users: many(users),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  aiSettings: one(userAiSettings, {
    fields: [users.id],
    references: [userAiSettings.userId],
  }),
  office: one(offices, {
    fields: [users.officeId],
    references: [offices.id],
  }),
  team: one(teams, {
    fields: [users.teamId],
    references: [teams.id],
  }),
  category: one(categories, {
    fields: [users.categoryId],
    references: [categories.id],
  }),
  lexnetAccounts: many(lexnetAccounts),
  assignedNotifications: many(notifications),
  packages: many(lexnetPackages),
  auditLogs: many(auditLogs),
  integrationTokens: many(integrationTokens),
}));

export const lexnetAccountsRelations = relations(lexnetAccounts, ({ one }) => ({
  user: one(users, {
    fields: [lexnetAccounts.userId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [lexnetAccounts.agentId],
    references: [agents.id],
  }),
}));

export const lexnetPackagesRelations = relations(lexnetPackages, ({ one, many }) => ({
  lawyer: one(users, {
    fields: [lexnetPackages.lawyerId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [lexnetPackages.agentId],
    references: [agents.id],
  }),
  documents: many(documents),
  notifications: many(notifications),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  package: one(lexnetPackages, {
    fields: [documents.packageId],
    references: [lexnetPackages.id],
  }),
  notification: one(notifications, {
    fields: [documents.notificationId],
    references: [notifications.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one, many }) => ({
  package: one(lexnetPackages, {
    fields: [notifications.packageId],
    references: [lexnetPackages.id],
  }),
  assignedLawyer: one(users, {
    fields: [notifications.assignedLawyerId],
    references: [users.id],
  }),
  triageAssignee: one(users, {
    fields: [notifications.triageAssignedTo],
    references: [users.id],
  }),
  documents: many(documents),
  executionPlans: many(executionPlans),
  caseMatches: many(caseMatches),
  externalDownloads: many(externalDownloads),
}));

export const caseMatchesRelations = relations(caseMatches, ({ one }) => ({
  notification: one(notifications, {
    fields: [caseMatches.notificationId],
    references: [notifications.id],
  }),
  confirmer: one(users, {
    fields: [caseMatches.confirmedBy],
    references: [users.id],
  }),
}));

export const externalDownloadsRelations = relations(externalDownloads, ({ one }) => ({
  notification: one(notifications, {
    fields: [externalDownloads.notificationId],
    references: [notifications.id],
  }),
}));

export const userInvitationsRelations = relations(userInvitations, ({ one }) => ({
  office: one(offices, {
    fields: [userInvitations.officeId],
    references: [offices.id],
  }),
  team: one(teams, {
    fields: [userInvitations.teamId],
    references: [teams.id],
  }),
  inviter: one(users, {
    fields: [userInvitations.invitedBy],
    references: [users.id],
  }),
}));

export const executionPlansRelations = relations(executionPlans, ({ one, many }) => ({
  notification: one(notifications, {
    fields: [executionPlans.notificationId],
    references: [notifications.id],
  }),
  reviewer: one(users, {
    fields: [executionPlans.reviewedBy],
    references: [users.id],
  }),
  approver: one(users, {
    fields: [executionPlans.approvedBy],
    references: [users.id],
  }),
  actions: many(executionActions),
}));

export const executionActionsRelations = relations(executionActions, ({ one }) => ({
  plan: one(executionPlans, {
    fields: [executionActions.planId],
    references: [executionPlans.id],
  }),
  approver: one(users, {
    fields: [executionActions.approvedBy],
    references: [users.id],
  }),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  office: one(offices, {
    fields: [agents.officeId],
    references: [offices.id],
  }),
  logs: many(agentLogs),
  lexnetAccounts: many(lexnetAccounts),
  packages: many(lexnetPackages),
}));

export const agentLogsRelations = relations(agentLogs, ({ one }) => ({
  agent: one(agents, {
    fields: [agentLogs.agentId],
    references: [agents.id],
  }),
}));

export const holidaysRelations = relations(holidays, ({ one }) => ({
  office: one(offices, {
    fields: [holidays.officeId],
    references: [offices.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email(),
  username: z.string().min(3).max(50),
  password: z.string().min(6),
  fullName: z.string().min(2),
});

export const selectUserSchema = createSelectSchema(users);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Office = typeof offices.$inferSelect;
export type InsertOffice = typeof offices.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type InsertTeam = typeof teams.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;
export type LexnetAccount = typeof lexnetAccounts.$inferSelect;
export type LexnetPackage = typeof lexnetPackages.$inferSelect;
export type InsertLexnetPackage = typeof lexnetPackages.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type ExecutionPlan = typeof executionPlans.$inferSelect;
export type InsertExecutionPlan = typeof executionPlans.$inferInsert;
export type ExecutionAction = typeof executionActions.$inferSelect;
export type InsertExecutionAction = typeof executionActions.$inferInsert;
export type Holiday = typeof holidays.$inferSelect;
export type DeadlineRule = typeof deadlineRules.$inferSelect;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type EventTemplate = typeof eventTemplates.$inferSelect;
export type RejectedItem = typeof rejectedItems.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;
export type AgentLog = typeof agentLogs.$inferSelect;
export type UserAiSettings = typeof userAiSettings.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type UserInvitation = typeof userInvitations.$inferSelect;
export type InsertUserInvitation = typeof userInvitations.$inferInsert;
export type CaseMatch = typeof caseMatches.$inferSelect;
export type InsertCaseMatch = typeof caseMatches.$inferInsert;
export type ExternalDownload = typeof externalDownloads.$inferSelect;
export type InsertExternalDownload = typeof externalDownloads.$inferInsert;
