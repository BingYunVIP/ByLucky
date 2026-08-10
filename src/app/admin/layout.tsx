import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "管理后台",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function AdminRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
