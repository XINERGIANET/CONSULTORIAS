import { Outlet } from "react-router-dom";
import { useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { useApexTheme } from "../context/ThemeContext";

export function ApexLayout() {
  const { isLight } = useApexTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div
      className={[
        "flex h-full min-h-screen w-full flex-col",
        isLight ? "bg-[#F9FAFB]" : "bg-[#000000]",
      ].join(" ")}
    >
      <div className="flex min-h-0 flex-1 relative">
        <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
        <div className="flex min-w-0 flex-1 flex-col w-full max-w-full">
          <TopBar setMobileMenuOpen={setMobileMenuOpen} />
          <Outlet />
        </div>
      </div>
    </div>
  );
}
