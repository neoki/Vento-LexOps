import { pgTable, text, serial, integer, boolean, timestamp, jsonb, pgEnum, uuid, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'LAWYER', 'ASSISTANT']);
export const aiProviderEnum = pgEnum('ai_provider', ['OPENAI', 'GEMINI']);
export const notificationStatusEnum = pgEnum('notification_status', ['PENDING', 'TRIAGE_REQUIRED', 'REVIEWED', 'SYNCED', 'ERROR']);
export const priorityEnum = pgEnum('priority', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export const agentStatusEnum = pgEnum('agent_status', ['ONLINE', 'OFFLINE', 'ERROR']);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: userRoleEnum("role").notNull().default('ASSISTANT'),
  isActive: boolean("is_active").notNull().default(true),
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

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  lexnetId: text("lexnet_id").notNull(),
  receivedDate: timestamp("received_date").notNull(),
  downloadedDate: timestamp("downloaded_date"),
  court: text("court").notNull(),
  procedureType: text("procedure_type"),
  procedureNumber: text("procedure_number").notNull(),
  status: notificationStatusEnum("status").notNull().default('PENDING'),
  priority: priorityEnum("priority").notNull().default('MEDIUM'),
  docType: text("doc_type"),
  aiConfidence: integer("ai_confidence"),
  aiReasoning: jsonb("ai_reasoning"),
  extractedDeadlines: jsonb("extracted_deadlines"),
  suggestedCaseId: text("suggested_case_id"),
  assignedLawyerId: integer("assigned_lawyer_id").references(() => users.id),
  inventoCaseId: text("invento_case_id"),
  hasZip: boolean("has_zip").default(false),
  hasReceipt: boolean("has_receipt").default(false),
  rawPayload: jsonb("raw_payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull().unique(),
  name: text("name").notNull(),
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

export const usersRelations = relations(users, ({ many, one }) => ({
  aiSettings: one(userAiSettings, {
    fields: [users.id],
    references: [userAiSettings.userId],
  }),
  assignedNotifications: many(notifications),
  auditLogs: many(auditLogs),
  integrationTokens: many(integrationTokens),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  assignedLawyer: one(users, {
    fields: [notifications.assignedLawyerId],
    references: [users.id],
  }),
}));

export const agentsRelations = relations(agents, ({ many }) => ({
  logs: many(agentLogs),
}));

export const agentLogsRelations = relations(agentLogs, ({ one }) => ({
  agent: one(agents, {
    fields: [agentLogs.agentId],
    references: [agents.id],
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
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;
export type AgentLog = typeof agentLogs.$inferSelect;
export type UserAiSettings = typeof userAiSettings.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
