import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Minha Casa Conectada - Compare Planos de Internet Fibra",

  description:
    "Compare os melhores planos de internet fibra óptica disponíveis no seu endereço. Encontre a melhor conexão para sua casa.",

  keywords: [
    "internet fibra",
    "planos internet",
    "fibra óptica",
    "comparar planos",
    "banda larga",
  ],

  verification: {
    other: {
      "facebook-domain-verification":
        "9gao2jleg63p4rwm12jhf0p9z11qen",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
