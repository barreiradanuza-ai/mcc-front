import { AlertTriangle } from "lucide-react";
import Link from "next/link";

interface SearchErrorProps {
  message: string;
}

export function SearchError({ message }: SearchErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <h2 className="mb-2 text-lg font-semibold text-gray-900">
        Erro na busca
      </h2>
      <p className="mb-6 max-w-md text-center text-sm text-gray-500">
        {message}
      </p>
      <Link
        href="/"
        className="rounded-lg bg-[#0066CC] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#004E9A]"
      >
        Tentar novamente
      </Link>
    </div>
  );
}
