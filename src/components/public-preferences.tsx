"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";

export type PublicLocale = "zh" | "en";
export type PublicTheme = "light" | "dark";

type PublicMessages = {
  brand: string;
  bingyunAi: string;
  bingyunStore: string;
  bingyunDocs: string;
  switchToEnglish: string;
  switchToChinese: string;
  switchToDark: string;
  switchToLight: string;
  currentActivity: string;
  noOpenActivity: string;
  prizeCount: string;
  participantCount: string;
  winnerSlots: string;
  drawProgress: string;
  noProgress: string;
  targetReached: string;
  drawPreparing: string;
  automaticDrawRemaining: (count: number) => string;
  scheduledDraw: (value: string) => string;
  manualDraw: string;
  prizes: string;
  noPrizes: string;
  joinTitle: string;
  email: string;
  emailPlaceholder: string;
  code: string;
  codePlaceholder: string;
  joinNow: string;
  joining: string;
  unavailable: string;
  joinSuccess: string;
  submittedCodes: string;
  totalValue: string;
  currentProgress: string;
  continueHint: string;
  continueAdd: string;
  waitingForDraw: string;
  unableToUse: string;
  invalidCode: string;
  invalidEmail: string;
  emailDomainNotAllowed: string;
  tooManyRequests: string;
  noActiveCampaign: string;
  joinFailed: string;
  recentWinners: string;
  noWinners: string;
  recentIssues: string;
  noHistory: string;
  issue: (value: number) => string;
  prizeQuantity: (value: number) => string;
  people: string;
  participants: string;
  winners: string;
  drawTime: string;
};

const messages: Record<PublicLocale, PublicMessages> = {
  zh: {
    brand: "冰云抽奖",
    bingyunAi: "冰云AI",
    bingyunStore: "冰云小店",
    bingyunDocs: "冰云文档",
    switchToEnglish: "切换为英文",
    switchToChinese: "切换为中文",
    switchToDark: "切换为深色模式",
    switchToLight: "切换为亮色模式",
    currentActivity: "当前活动",
    noOpenActivity: "暂无开放活动",
    prizeCount: "奖项数量",
    participantCount: "参与人数",
    winnerSlots: "中奖名额",
    drawProgress: "开奖进度",
    noProgress: "—",
    targetReached: "已达到开奖人数，正在准备开奖。",
    drawPreparing: "活动正在进入开奖流程。",
    automaticDrawRemaining: (count) => `还差 ${count} 个不同邮箱开奖`,
    scheduledDraw: (value) => `${value} 开奖`,
    manualDraw: "开奖进度将持续更新",
    prizes: "本期奖项",
    noPrizes: "奖项将在活动开放后公布。",
    joinTitle: "参与本期抽奖",
    email: "邮箱地址",
    emailPlaceholder: "例如 user@qq.com",
    code: "购买获得的兑换码",
    codePlaceholder: "精确输入兑换码",
    joinNow: "立即参与抽奖",
    joining: "正在参与…",
    unavailable: "暂未开放",
    joinSuccess: "参与成功",
    submittedCodes: "本期已提交",
    totalValue: "累计面值",
    currentProgress: "当前活动",
    continueHint: "还可以继续输入该邮箱购买的其他兑换码，提高本期累计面值。",
    continueAdd: "继续添加兑换码",
    waitingForDraw: "本期人数已满，系统正在进入开奖流程。",
    unableToUse: "无法使用该兑换码",
    invalidCode: "兑换码无效、已经使用，或不符合当前活动要求。",
    invalidEmail: "请输入有效且受支持的邮箱地址。",
    emailDomainNotAllowed: "当前邮箱域名暂不支持。",
    tooManyRequests: "请求过于频繁，请稍后再试。",
    noActiveCampaign: "当前暂无进行中的抽奖活动。",
    joinFailed: "参与失败，请稍后重试。",
    recentWinners: "最近中奖",
    noWinners: "暂无已完成的中奖记录。",
    recentIssues: "最近期数",
    noHistory: "暂无已完成的历史活动。",
    issue: (value) => `第 ${value} 期`,
    prizeQuantity: (value) => `${value} 名`,
    people: "人",
    participants: "参与人数",
    winners: "中奖人数",
    drawTime: "开奖时间",
  },
  en: {
    brand: "ByLucky",
    bingyunAi: "BingYun AI",
    bingyunStore: "BingYun Store",
    bingyunDocs: "BingYun Docs",
    switchToEnglish: "Switch to English",
    switchToChinese: "Switch to Chinese",
    switchToDark: "Switch to dark mode",
    switchToLight: "Switch to light mode",
    currentActivity: "Current campaign",
    noOpenActivity: "No campaign is open right now",
    prizeCount: "Prize tiers",
    participantCount: "Participants",
    winnerSlots: "Winner slots",
    drawProgress: "Draw progress",
    noProgress: "—",
    targetReached: "The participant target has been reached. Preparing the draw.",
    drawPreparing: "The campaign is moving into the draw process.",
    automaticDrawRemaining: (count) => `${count} more unique email${count === 1 ? "" : "s"} until the draw`,
    scheduledDraw: (value) => `Draws at ${value}`,
    manualDraw: "Draw progress will be updated here",
    prizes: "Prizes",
    noPrizes: "Prizes will be announced when a campaign opens.",
    joinTitle: "Join this campaign",
    email: "Email address",
    emailPlaceholder: "For example, user@qq.com",
    code: "Code from your purchase",
    codePlaceholder: "Enter the code exactly",
    joinNow: "Join the draw",
    joining: "Joining…",
    unavailable: "Not open yet",
    joinSuccess: "Successfully joined",
    submittedCodes: "Codes submitted",
    totalValue: "Total value",
    currentProgress: "Campaign progress",
    continueHint: "You can add more codes purchased with this email to increase your total value for this campaign.",
    continueAdd: "Add another code",
    waitingForDraw: "The participant target has been reached. The draw is being prepared.",
    unableToUse: "This code cannot be used",
    invalidCode: "The code is invalid, already used, or not eligible for this campaign.",
    invalidEmail: "Enter a valid supported email address.",
    emailDomainNotAllowed: "This email domain is not currently supported.",
    tooManyRequests: "Too many requests. Please try again shortly.",
    noActiveCampaign: "There is no active campaign right now.",
    joinFailed: "Unable to join the draw. Please try again shortly.",
    recentWinners: "Recent winners",
    noWinners: "There are no completed winner records yet.",
    recentIssues: "Recent campaigns",
    noHistory: "There are no completed campaigns yet.",
    issue: (value) => `Issue ${value}`,
    prizeQuantity: (value) => `${value} winner${value === 1 ? "" : "s"}`,
    people: "people",
    participants: "Participants",
    winners: "Winners",
    drawTime: "Draw time",
  },
};

type PublicPreferencesValue = {
  locale: PublicLocale;
  theme: PublicTheme;
  copy: PublicMessages;
  setLocale: (locale: PublicLocale) => void;
  setTheme: (theme: PublicTheme) => void;
};

const PublicPreferencesContext = createContext<PublicPreferencesValue | null>(null);
const preferenceListeners = new Set<() => void>();
const localeStorageKey = "bylucky-public-locale";
const themeStorageKey = "bylucky-public-theme";

function validLocale(value: string | null): value is PublicLocale {
  return value === "zh" || value === "en";
}

function validTheme(value: string | null): value is PublicTheme {
  return value === "light" || value === "dark";
}

function getLocaleSnapshot(): PublicLocale {
  if (typeof window === "undefined") return "zh";
  const value = window.localStorage.getItem(localeStorageKey);
  return validLocale(value) ? value : "zh";
}

function getThemeSnapshot(): PublicTheme {
  if (typeof window === "undefined") return "light";
  const value = window.localStorage.getItem(themeStorageKey);
  return validTheme(value) ? value : "light";
}

function getServerLocaleSnapshot(): PublicLocale {
  return "zh";
}

function getServerThemeSnapshot(): PublicTheme {
  return "light";
}

function subscribeToPreferences(listener: () => void) {
  preferenceListeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === localeStorageKey || event.key === themeStorageKey) listener();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    preferenceListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function notifyPreferenceListeners() {
  preferenceListeners.forEach((listener) => listener());
}

function applyPreference(locale: PublicLocale, theme: PublicTheme) {
  document.documentElement.dataset.publicLocale = locale;
  document.documentElement.dataset.publicTheme = theme;
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
}

export function PublicPreferencesProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribeToPreferences, getLocaleSnapshot, getServerLocaleSnapshot);
  const theme = useSyncExternalStore(subscribeToPreferences, getThemeSnapshot, getServerThemeSnapshot);

  useEffect(() => {
    applyPreference(locale, theme);
  }, [locale, theme]);

  useEffect(() => {
    return () => {
      document.documentElement.removeAttribute("data-public-locale");
      document.documentElement.removeAttribute("data-public-theme");
      document.documentElement.lang = "zh-CN";
    };
  }, []);

  const setLocale = useCallback((nextLocale: PublicLocale) => {
    window.localStorage.setItem(localeStorageKey, nextLocale);
    applyPreference(nextLocale, theme);
    notifyPreferenceListeners();
  }, [theme]);

  const setTheme = useCallback((nextTheme: PublicTheme) => {
    window.localStorage.setItem(themeStorageKey, nextTheme);
    applyPreference(locale, nextTheme);
    notifyPreferenceListeners();
  }, [locale]);

  const value = useMemo(() => ({ locale, theme, copy: messages[locale], setLocale, setTheme }), [locale, setLocale, setTheme, theme]);
  return <PublicPreferencesContext.Provider value={value}>{children}</PublicPreferencesContext.Provider>;
}

export function usePublicPreferences() {
  const value = useContext(PublicPreferencesContext);
  if (!value) throw new Error("usePublicPreferences must be used within PublicPreferencesProvider");
  return value;
}

export function formatPublicDate(value: string | null, locale: PublicLocale) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  if (locale === "en") {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Shanghai",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date);
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("month")} 月 ${part("day")} 日 ${part("hour")}:${part("minute")}`;
}
