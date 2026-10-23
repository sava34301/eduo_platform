import type { Metadata } from "next";
import "./globals.css";
import "./campus.css";
import "./enrichment.css";
import "./school-directory.css";
import "./classwork.css";
import "./classwork-inbox.css";
import "./school-learning.css";
import "./school-practice.css";
import "./api-recovery.css";
import "./school-gradebook.css";
import "./school-attendance.css";
import "./module-catalogue.css";

export const metadata: Metadata = {
  title: "Eduo — моето училище",
  description: "Твоето учене. Твоят ритъм. Българска училищна платформа за ученици, учители и родители.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bg">
      <body className="antialiased">{children}</body>
    </html>
  );
}
