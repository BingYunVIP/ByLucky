import type { BadgeTone } from "@/components/ui/badge";

export function formatAdminDate(value: string | Date | null | undefined, includeSeconds = false) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    dateStyle: "medium",
    timeStyle: includeSeconds ? "medium" : "short",
  }).format(new Date(value));
}

export function campaignStatusLabel(status: string) {
  return ({
    DRAFT: "草稿",
    ACTIVE: "进行中",
    LOCKED: "已锁定",
    DRAWING: "开奖中",
    COMPLETED: "已完成",
    ARCHIVED: "已归档",
    DRAW_FAILED: "开奖失败",
    CANCELED: "已取消",
    CANCELLED: "已取消",
  } as Record<string, string>)[status] ?? status;
}

export function campaignStatusTone(status: string): BadgeTone {
  return ({
    DRAFT: "neutral",
    ACTIVE: "info",
    LOCKED: "warning",
    DRAWING: "warning",
    COMPLETED: "success",
    ARCHIVED: "neutral",
    DRAW_FAILED: "danger",
    CANCELED: "danger",
    CANCELLED: "danger",
  } as Record<string, BadgeTone>)[status] ?? "neutral";
}

export function drawMethodLabel(method: string) {
  return method === "FACE_VALUE_PRIORITY" ? "面值优先抽奖" : "每张兑换码等权";
}

export function drawTriggerLabel(trigger: string, drawAt?: string | Date | null) {
  if (trigger === "PARTICIPANT_TARGET") return "满人数自动开奖";
  if (trigger === "SCHEDULED") return drawAt ? `指定时间 · ${formatAdminDate(drawAt)}` : "指定时间开奖";
  return "仅管理员手动开奖";
}

export function emailStatusLabel(status: string) {
  return ({
    PENDING: "待发送",
    SENDING: "发送中",
    SENT: "已发送",
    FAILED: "发送失败",
    NOT_CREATED: "未创建",
  } as Record<string, string>)[status] ?? status;
}

export function emailStatusTone(status: string): BadgeTone {
  return ({
    PENDING: "warning",
    SENDING: "info",
    SENT: "success",
    FAILED: "danger",
    NOT_CREATED: "neutral",
  } as Record<string, BadgeTone>)[status] ?? "neutral";
}

const operationLabels: Record<string, { title: string; icon: string }> = {
  ADMIN_LOGIN_SUCCEEDED: { title: "管理员登录成功", icon: "login" },
  ADMIN_LOGIN_FAILED: { title: "管理员登录失败", icon: "error" },
  ADMIN_LOGIN_BLOCKED: { title: "管理员登录被限流", icon: "block" },
  ADMIN_LOGOUT: { title: "管理员退出登录", icon: "logout" },
  CAMPAIGN_CREATED: { title: "创建活动", icon: "add_circle" },
  CAMPAIGN_DRAFT_UPDATED: { title: "更新活动草稿", icon: "edit_note" },
  CAMPAIGN_DELETED: { title: "删除活动草稿", icon: "delete" },
  CAMPAIGN_STARTED: { title: "启动活动", icon: "play_circle" },
  CAMPAIGN_CANCELED: { title: "取消活动", icon: "cancel" },
  CAMPAIGN_MANUAL_DRAW_REQUESTED: { title: "请求立即开奖", icon: "casino" },
  CAMPAIGN_DRAW_RETRY_REQUESTED: { title: "请求重试开奖", icon: "refresh" },
  CAMPAIGN_DRAW_COMPLETED: { title: "开奖完成", icon: "emoji_events" },
  CAMPAIGN_DRAW_FAILED: { title: "开奖失败", icon: "error" },
  CAMPAIGN_CODES_IMPORTED: { title: "导入核实兑换码", icon: "confirmation_number" },
  CAMPAIGN_CODES_CLEANED: { title: "清理未使用核实码", icon: "delete_sweep" },
  SYSTEM_SETTINGS_UPDATED: { title: "修改系统设置", icon: "settings" },
  EMAIL_DOMAIN_RULE_CREATED: { title: "新增邮箱规则", icon: "add_circle" },
  EMAIL_DOMAIN_RULE_UPDATED: { title: "修改邮箱规则", icon: "edit" },
  EMAIL_DOMAIN_RULE_DELETED: { title: "删除邮箱规则", icon: "delete" },
  SMTP_CONFIG_UPDATED: { title: "保存 SMTP 配置", icon: "mail" },
  SMTP_TEST_SUCCEEDED: { title: "测试邮件发送成功", icon: "mark_email_read" },
  SMTP_TEST_FAILED: { title: "测试邮件发送失败", icon: "error" },
  EMAIL_TEMPLATE_UPDATED: { title: "保存邮件模板", icon: "edit_note" },
  EMAIL_JOB_MANUAL_RETRY: { title: "重试邮件任务", icon: "refresh" },
};

export function operationPresentation(action: string) {
  return operationLabels[action] ?? { title: "系统操作", icon: "history" };
}

export function actorLabel(actor: string) {
  return actor === "ADMIN" ? "管理员" : actor === "SYSTEM" ? "系统任务" : actor;
}

export function operationSummary(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "已记录此项操作。";
  const values = metadata as Record<string, unknown>;
  const number = (key: string) => typeof values[key] === "number" ? values[key] : typeof values[key] === "string" && /^\d+$/.test(values[key]) ? Number(values[key]) : null;
  const participantCount = number("participantCount");
  const winnerCount = number("winnerCount");
  const importedCodeCount = number("importedCodeCount");
  const deletedCount = number("deletedCount");
  const issueNo = number("issueNo");

  if (participantCount !== null && winnerCount !== null) return `${participantCount} 人参与 · ${winnerCount} 人中奖`;
  if (importedCodeCount !== null) return `导入 ${importedCodeCount} 张核实兑换码`;
  if (deletedCount !== null) return `清理 ${deletedCount} 张未使用核实码`;
  if (issueNo !== null) return `第 ${issueNo} 期活动`;
  return "已记录此项操作。";
}
