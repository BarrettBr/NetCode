import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Code from "@/pages/Code";
import Landing from "@/pages/Landing";
import Account from "@/pages/Account";
import Navbar from "@/components/navigation/Navbar";
import Workspace from "@/pages/Workspace";
import { useState } from "react";

function AppWrapper() {
  const location = useLocation();
  const isWorkspace = location.pathname.startsWith("/workspace");
  const isLanding = location.pathname.startsWith("/home");
  const [currentSite, setSite] = useState("dash");

  return (
    <div className="flex flex-col min-h-screen bg-bg text-white">
      <Navbar currentSite={currentSite} setSite={setSite} />
      <div
        className={`flex flex-col flex-1 pt-[70px] overflow-hidden ${
          isWorkspace || isLanding ? "" : "mx-5 sm:mx-10"
        }`}
      >
        <Routes>
          <Route path="/" element={<Code />} />
          <Route path="/home" element={<Landing />} />
          <Route path="/account" element={<Account />} />
          <Route
            path="/workspace"
            element={<Workspace currentSite={currentSite} setSite={setSite} />}
          />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppWrapper />
    </BrowserRouter>
  );
}

export default App;
