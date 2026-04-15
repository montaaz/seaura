import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "S E A U R A  | Site Officiel",
  description: "Découvrez la nouvelle collection de sacs, vêtements, bijoux et chaussures chez Parfois.",
  icons: {
    icon: "/icon.png",
  },
};

import { Providers } from "@/components/Providers";
import EmailModal from "@/components/EmailModal";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Kalnia:wght@100..700&family=Raleway:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>
          {children}
          <EmailModal />
        </Providers>
      </body>
    </html>
  );
}

