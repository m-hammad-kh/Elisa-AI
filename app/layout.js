﻿import { Inter } from "next/font/google";
import "./globals.css";
import Provider from "./provider";
import ConvexClientProvider from "./ConvexClientProvider";

import CustomCursor from "@/components/custom/CustomCursor";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Elisa AI - Website Builder",
  description: "Build production-ready applications in minutes with Elisa AI.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} cursor-none`}>
        <CustomCursor />
        <ConvexClientProvider>
          <Provider>
            {children}
          </Provider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
