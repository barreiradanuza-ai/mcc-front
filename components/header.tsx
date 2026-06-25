"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";

const SCROLL_THRESHOLD = 24;

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > SCROLL_THRESHOLD);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isLight = scrolled;

  return (
    <header
      className={`sticky top-0 z-50 border-b shadow-sm transition-all duration-300 ${
        isLight
          ? "border-[#004E9A]/15 bg-white/85 text-[#004E9A] backdrop-blur-md"
          : "border-white/10 bg-[#004E9A] text-white"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center">
          <Image
            src={
              isLight
                ? "/logos/logo-horizontal-colorido.png"
                : "/logos/logo-horizontal.png"
            }
            alt="Minha Casa Conectada"
            width={180}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          <Link
            href="/"
            className={
              isLight
                ? "text-[#004E9A] transition-colors hover:text-[#0066CC]"
                : "transition-colors hover:text-white/80"
            }
          >
            Internet
          </Link>
          <Link
            href="/#como-funciona"
            className={
              isLight
                ? "text-[#004E9A] transition-colors hover:text-[#0066CC]"
                : "transition-colors hover:text-white/80"
            }
          >
            Como Funciona
          </Link>
          <Link
            href="/#sobre"
            className={
              isLight
                ? "text-[#004E9A] transition-colors hover:text-[#0066CC]"
                : "transition-colors hover:text-white/80"
            }
          >
            Sobre
          </Link>
        </nav>

        <button
          className={`md:hidden ${isLight ? "text-[#004E9A]" : ""}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {menuOpen && (
        <nav
          className={`px-4 py-3 md:hidden ${
            isLight
              ? "border-t border-[#004E9A]/15 bg-white/95 backdrop-blur-sm"
              : "border-t border-white/10"
          }`}
        >
          <div className="flex flex-col gap-3 text-sm font-medium">
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className={isLight ? "text-[#004E9A] hover:text-[#0066CC]" : ""}
            >
              Internet
            </Link>
            <Link
              href="/#como-funciona"
              onClick={() => setMenuOpen(false)}
              className={isLight ? "text-[#004E9A] hover:text-[#0066CC]" : ""}
            >
              Como Funciona
            </Link>
            <Link
              href="/#sobre"
              onClick={() => setMenuOpen(false)}
              className={isLight ? "text-[#004E9A] hover:text-[#0066CC]" : ""}
            >
              Sobre
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
