// Hand-written to match supabase/migrations exactly.
// After `npx supabase db push`, this can be regenerated with:
//   npx supabase gen types typescript --linked > types/db.ts
// (keep the convenience aliases at the bottom).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TaskStatus = "todo" | "in_progress" | "done" | "blocked";
export type TaskPriority = "p1" | "p2" | "p3" | "p4";
export type EntrySource = "app" | "telegram";
export type PipelineEventType = "lead_added" | "proposal_sent" | "deal_won" | "deal_lost";
export type MoneyType = "revenue" | "expense";
export type MetricAggregation = "sum" | "last";
export type IdeaStage = "raw" | "evaluating" | "validated" | "executing" | "archived";
export type InboxAction = "create_task" | "log_pipeline" | "log_money" | "log_metric" | "capture_idea" | "unknown";
export type InboxStatus = "received" | "pending_confirm" | "applied" | "cancelled" | "undone" | "failed";
export type CronJob = "morning" | "evening";

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          slug: string;
          name: string;
          color: string | null;
          description: string | null;
          context_md: string | null;
          features: Json;
          targets: Json;
          sort_order: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          color?: string | null;
          description?: string | null;
          context_md?: string | null;
          features?: Json;
          targets?: Json;
          sort_order?: number;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          color?: string | null;
          description?: string | null;
          context_md?: string | null;
          features?: Json;
          targets?: Json;
          sort_order?: number;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          description: string | null;
          priority: TaskPriority;
          is_urgent: boolean;
          is_important: boolean;
          status: TaskStatus;
          due_date: string | null;
          tags: string[];
          sort_order: number;
          completed_at: string | null;
          source: EntrySource;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          description?: string | null;
          priority?: TaskPriority;
          is_urgent?: boolean;
          is_important?: boolean;
          status?: TaskStatus;
          due_date?: string | null;
          tags?: string[];
          sort_order?: number;
          completed_at?: string | null;
          source?: EntrySource;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          description?: string | null;
          priority?: TaskPriority;
          is_urgent?: boolean;
          is_important?: boolean;
          status?: TaskStatus;
          due_date?: string | null;
          tags?: string[];
          sort_order?: number;
          completed_at?: string | null;
          source?: EntrySource;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      metric_definitions: {
        Row: {
          id: string;
          project_id: string;
          key: string;
          name: string;
          unit: string | null;
          aggregation: MetricAggregation;
          weekly_target: number | null;
          quick_increment: number | null;
          sort_order: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          key: string;
          name: string;
          unit?: string | null;
          aggregation?: MetricAggregation;
          weekly_target?: number | null;
          quick_increment?: number | null;
          sort_order?: number;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          key?: string;
          name?: string;
          unit?: string | null;
          aggregation?: MetricAggregation;
          weekly_target?: number | null;
          quick_increment?: number | null;
          sort_order?: number;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "metric_definitions_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      metric_entries: {
        Row: {
          id: string;
          metric_id: string;
          project_id: string;
          value: number;
          note: string | null;
          entry_date: string;
          source: EntrySource;
          created_at: string;
        };
        Insert: {
          id?: string;
          metric_id: string;
          project_id: string;
          value: number;
          note?: string | null;
          entry_date: string;
          source?: EntrySource;
          created_at?: string;
        };
        Update: {
          id?: string;
          metric_id?: string;
          project_id?: string;
          value?: number;
          note?: string | null;
          entry_date?: string;
          source?: EntrySource;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "metric_entries_metric_id_fkey";
            columns: ["metric_id"];
            isOneToOne: false;
            referencedRelation: "metric_definitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metric_entries_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      pipeline_events: {
        Row: {
          id: string;
          project_id: string;
          type: PipelineEventType;
          contact: string | null;
          value_mad: number | null;
          note: string | null;
          event_date: string;
          source: EntrySource;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          type: PipelineEventType;
          contact?: string | null;
          value_mad?: number | null;
          note?: string | null;
          event_date: string;
          source?: EntrySource;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          type?: PipelineEventType;
          contact?: string | null;
          value_mad?: number | null;
          note?: string | null;
          event_date?: string;
          source?: EntrySource;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pipeline_events_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      money_entries: {
        Row: {
          id: string;
          project_id: string;
          type: MoneyType;
          amount_mad: number;
          category: string | null;
          note: string | null;
          entry_date: string;
          source: EntrySource;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          type: MoneyType;
          amount_mad: number;
          category?: string | null;
          note?: string | null;
          entry_date: string;
          source?: EntrySource;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          type?: MoneyType;
          amount_mad?: number;
          category?: string | null;
          note?: string | null;
          entry_date?: string;
          source?: EntrySource;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "money_entries_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      report_snapshots: {
        Row: {
          id: string;
          week_start: string;
          payload: Json;
          overall_score: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          week_start: string;
          payload: Json;
          overall_score?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          week_start?: string;
          payload?: Json;
          overall_score?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      telegram_inbox: {
        Row: {
          id: string;
          telegram_update_id: number;
          chat_id: number | null;
          message_id: number | null;
          raw_text: string | null;
          action: InboxAction | null;
          parsed: Json | null;
          status: InboxStatus;
          result_table: string | null;
          result_id: string | null;
          bot_message_id: number | null;
          error: string | null;
          created_at: string;
          decided_at: string | null;
        };
        Insert: {
          id?: string;
          telegram_update_id: number;
          chat_id?: number | null;
          message_id?: number | null;
          raw_text?: string | null;
          action?: InboxAction | null;
          parsed?: Json | null;
          status?: InboxStatus;
          result_table?: string | null;
          result_id?: string | null;
          bot_message_id?: number | null;
          error?: string | null;
          created_at?: string;
          decided_at?: string | null;
        };
        Update: {
          id?: string;
          telegram_update_id?: number;
          chat_id?: number | null;
          message_id?: number | null;
          raw_text?: string | null;
          action?: InboxAction | null;
          parsed?: Json | null;
          status?: InboxStatus;
          result_table?: string | null;
          result_id?: string | null;
          bot_message_id?: number | null;
          error?: string | null;
          created_at?: string;
          decided_at?: string | null;
        };
        Relationships: [];
      };
      cron_runs: {
        Row: {
          id: string;
          job: CronJob;
          local_date: string;
          status: string;
          detail: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job: CronJob;
          local_date: string;
          status?: string;
          detail?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          job?: CronJob;
          local_date?: string;
          status?: string;
          detail?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          key: string;
          value: Json | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value?: Json | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          content_md: string;
          pinned: boolean;
          tags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          content_md?: string;
          pinned?: boolean;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          content_md?: string;
          pinned?: boolean;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      ideas: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          description: string | null;
          stage: IdeaStage;
          impact: number | null;
          effort: number | null;
          converted_task_id: string | null;
          sort_order: number;
          source: EntrySource;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          description?: string | null;
          stage?: IdeaStage;
          impact?: number | null;
          effort?: number | null;
          converted_task_id?: string | null;
          sort_order?: number;
          source?: EntrySource;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          description?: string | null;
          stage?: IdeaStage;
          impact?: number | null;
          effort?: number | null;
          converted_task_id?: string | null;
          sort_order?: number;
          source?: EntrySource;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ideas_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ideas_converted_task_id_fkey";
            columns: ["converted_task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          }
        ];
      };
      links: {
        Row: {
          id: string;
          project_id: string;
          url: string;
          title: string | null;
          description: string | null;
          tags: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          url: string;
          title?: string | null;
          description?: string | null;
          tags?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          url?: string;
          title?: string | null;
          description?: string | null;
          tags?: string[];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "links_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      ai_conversations: {
        Row: {
          id: string;
          project_id: string;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_conversations_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: string;
          parts: Json;
          created_at: string;
        };
        Insert: {
          id: string;
          conversation_id: string;
          role: string;
          parts: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: string;
          parts?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      task_status: TaskStatus;
      task_priority: TaskPriority;
      entry_source: EntrySource;
      pipeline_event_type: PipelineEventType;
      money_type: MoneyType;
      metric_aggregation: MetricAggregation;
      idea_stage: IdeaStage;
      inbox_action: InboxAction;
      inbox_status: InboxStatus;
      cron_job: CronJob;
    };
    CompositeTypes: { [_ in never]: never };
  };
}

// Convenience row aliases
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type MetricDefinition = Database["public"]["Tables"]["metric_definitions"]["Row"];
export type MetricEntry = Database["public"]["Tables"]["metric_entries"]["Row"];
export type PipelineEvent = Database["public"]["Tables"]["pipeline_events"]["Row"];
export type MoneyEntry = Database["public"]["Tables"]["money_entries"]["Row"];
export type ReportSnapshot = Database["public"]["Tables"]["report_snapshots"]["Row"];
export type TelegramInboxRow = Database["public"]["Tables"]["telegram_inbox"]["Row"];
export type CronRun = Database["public"]["Tables"]["cron_runs"]["Row"];
export type Note = Database["public"]["Tables"]["notes"]["Row"];
export type Idea = Database["public"]["Tables"]["ideas"]["Row"];
export type LinkRow = Database["public"]["Tables"]["links"]["Row"];
export type AiConversation = Database["public"]["Tables"]["ai_conversations"]["Row"];
export type AiMessageRow = Database["public"]["Tables"]["ai_messages"]["Row"];

/** Typed view of projects.features */
export interface ProjectFeatures {
  pipeline: boolean;
  money: boolean;
}

/** Typed view of projects.targets */
export interface ProjectTargets {
  weekly_revenue_mad?: number;
}
