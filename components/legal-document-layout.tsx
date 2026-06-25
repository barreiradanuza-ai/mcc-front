import type { ReactNode } from "react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export function LegalDocumentLayout({
  title,
  updatedLabel,
  children,
}: {
  title: string;
  updatedLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header />
      <main className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white px-6 py-10 shadow-sm sm:px-10">
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            {title}
          </h1>
          <p className="mb-8 text-sm text-gray-500">{updatedLabel}</p>
          <div className="space-y-6 text-sm leading-relaxed text-gray-700 [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2:first-child]:mt-0 [&_li]:ml-4 [&_li]:list-disc [&_ol]:ml-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_p]:text-justify [&_strong]:font-semibold [&_strong]:text-gray-900 [&_ul]:space-y-1">
            {children}
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
