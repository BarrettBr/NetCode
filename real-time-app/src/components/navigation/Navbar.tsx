import { Menu, X } from "lucide-react";
import { NavLink, Link, useLocation } from "react-router-dom";
import logo from "@/assets/site_logo-color.png";
import { useState } from "react";

/*
  Navbar Component:
    Reusable Navbar Component that lives at the App level above the main content which switches

  Props:
    - currentSite: Used for when logged in for dashboard/hamburger menu display
    - setSite callback function to app to set currentSite
  
  Dependencies:
    - Logo from assets
    - Link used to navigate with buttons
*/
type Props = {
  currentSite: string;
  setSite: (site: string) => void;
};

function Navbar({ currentSite, setSite }: Props) {
  const [open, setOpen] = useState(false);
  const location = useLocation(); // <- get current path
  const isInWorkspace = location.pathname.startsWith("/workspace");
  const navItems = [{ label: "Login", to: "/account" }];

  const workspaceItems = [
    { label: "Dashboard", changeTo: "dash" },
    { label: "Code", changeTo: "code" },
    { label: "Settings", changeTo: "settings" },
  ];
  return (
    <nav className="fixed top-0 w-full flex items-center justify-between h-[70px] px-[20px] bg-bg border-b-1 border-Cborder text-[#edf0f1] z-[1000]">
      {/* Left section */}
      <div className="flex items-center space-x-2 ml-5 sm:ml-10">
        <Link
          to="/home"
          className="flex items-center text-[1.5rem] font-bold text-[#edf0f1] no-underline space-x-[0.5rem]"
        >
          <img src={logo} alt="Logo" className="h-[2.3rem] w-auto" />
          <span>NetCode</span>
        </Link>
      </div>

      {/* Hamburger (mobile only) */}
      <button
        onClick={() => setOpen(!open)}
        className="rounded-md p-2 md:hidden hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
        aria-label="Hamburger Menu"
      >
        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Right section */}
      <ul className="hidden gap-12 md:flex">
        {navItems.map((item) => (
          <li key={item.label}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `nav-item relative px-1 transition-colors duration-200 ${
                  isActive
                    ? "text-white"
                    : "text-zinc-300 hover:text-tab-active"
                }`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Slide-down sheet (mobile) */}
      {open && (
        <div className="md:hidden absolute top-[70px] right-0 w-full bg-[#1E1E1E] border-t border-white/10 z-40 shadow-lg">
          <ul className="flex flex-col gap-6 px-6 py-6">
            {navItems.map((item) => (
              <li key={item.label}>
                <NavLink
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `nav-item block text-lg ${
                      isActive ? "underline text-white" : "text-white/70"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}

            {/* Workspace-specific links on /workspace route */}
            {isInWorkspace &&
              workspaceItems.map((item) => (
                <li key={item.label}>
                  <button
                    onClick={() => {
                      setSite(item.changeTo);
                      setOpen(false);
                    }}
                    className={`nav-item block text-left text-lg ${
                      currentSite === item.changeTo
                        ? "underline text-white"
                        : "text-white/70"
                    }`}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
