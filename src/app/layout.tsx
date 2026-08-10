import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@material-symbols/font-400/rounded.css";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: {
    default: "欢迎使用 - 冰云抽奖",
    template: "%s - 冰云抽奖",
  },
  description: "ByLucky 冰云抽奖",
  icons: {
    icon: "/brand/logo.png",
    shortcut: "/brand/logo.png",
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: "#f5f6f7",
};

const publicPreferenceBootstrap = `
(() => {
  try {
    const isPublicRoute = window.location.pathname === "/";
    const root = document.documentElement;
    if (!isPublicRoute) {
      root.removeAttribute("data-public-theme");
      root.removeAttribute("data-public-locale");
      return;
    }
    const locale = window.localStorage.getItem("bylucky-public-locale");
    const theme = window.localStorage.getItem("bylucky-public-theme");
    if (locale === "zh" || locale === "en") {
      root.dataset.publicLocale = locale;
      root.lang = locale === "zh" ? "zh-CN" : "en";
    }
    if (theme === "light" || theme === "dark") root.dataset.publicTheme = theme;
  } catch (_) {
    // Preferences are optional and must never block the public page.
  }
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <Script id="public-preference-bootstrap" strategy="beforeInteractive">{publicPreferenceBootstrap}</Script>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
