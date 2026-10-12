import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoDoc AI | Repository intelligence",
  description: "Generate documentation that understands your codebase.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en"><body>{children}</body></html>;
}
