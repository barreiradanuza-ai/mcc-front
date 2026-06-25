"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Search } from "lucide-react";

const OPERATORS = [
  { name: "Claro", logo: "/logos/providers/claro.svg" },
  { name: "Tim", logo: "/logos/providers/tim.svg" },
  { name: "Nio", logo: "/logos/providers/nio.svg" },
];

export function SearchLoading() {
  const [progress, setProgress] = useState(0);
  const [currentOp, setCurrentOp] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90;
        return prev + Math.random() * 8 + 2;
      });
    }, 400);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentOp((prev) => (prev + 1) % OPERATORS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-gray-50 px-4">
      {/* Progress bar */}
      <div className="mb-12 w-full max-w-md">
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#004E9A] to-[#0077CC] transition-all duration-500 ease-out"
            style={{ width: `${Math.min(progress, 90)}%` }}
          />
        </div>
        <p className="mt-2 text-center text-xs text-gray-400">
          {Math.round(Math.min(progress, 90))}%
        </p>
      </div>

      {/* Rotating operator logo */}
      <div className="relative mb-8 flex h-28 w-28 items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-gray-100 bg-white shadow-lg" />
        <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#004E9A] shadow-md">
          <Search className="h-5 w-5 text-white" />
        </div>
        {OPERATORS.map((op, i) => (
          <div
            key={op.name}
            className="absolute inset-0 flex items-center justify-center p-5 transition-opacity duration-500"
            style={{ opacity: currentOp === i ? 1 : 0 }}
          >
            <Image
              src={op.logo}
              alt={op.name}
              width={64}
              height={64}
              className="h-auto max-h-16 w-auto max-w-16 object-contain"
              priority
            />
          </div>
        ))}
      </div>

      {/* Operator name */}
      <p className="mb-2 text-sm font-semibold text-gray-700">
        {OPERATORS[currentOp].name}
      </p>

      {/* Status text */}
      <p className="max-w-sm text-center text-sm text-gray-500">
        Estamos buscando os provedores disponíveis no seu endereço...
      </p>

      {/* Operator dots indicator */}
      <div className="mt-6 flex items-center gap-3">
        {OPERATORS.map((op, i) => (
          <div
            key={op.name}
            className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${
              currentOp === i ? "scale-125 bg-[#004E9A]" : "bg-gray-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
