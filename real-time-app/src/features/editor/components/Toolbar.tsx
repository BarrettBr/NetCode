import { useState } from "react";
import { AppConfig } from "@/config";
import LanguageSelector from "@/features/editor/components/LanguageSelector";

/* 
Tool Bar Component:
  Reusable Toolbar UI component that lets someone:
    - Select a programming language from a dropdown menu
    - Send code execution to the backend
    - Trigger AI code reviews via Gemini

Props:
  - reviewText: (text: string) => void
    A callback function used to update the review text area with the response from the backend AI code review
    Called to when clicking the "review code" button

Dependencies:
  - useState
  - FontAwesome (For dropdown icon)
  - Appconfig for room ID/Config
*/

type Props = {
  reviewText: (text: string) => void;
};

function Toolbar({ reviewText }: Props) {
  const [selectedLang, setLanguage] = useState({ id: 2, name: "C" });
  const hostname = window.location.hostname;

  async function run_code() {
    try {
      const response = await fetch(
        `${location.protocol}//${hostname}:${AppConfig.port}/api`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            event: "run_code",
            language: selectedLang.name,
            room: AppConfig.roomId,
          }),
        }
      );
      if (response.ok) {
        console.log("Run successful");
      }
    } catch (error) {
      console.error("Error Occured:", error);
    }
  }

  async function handleReviewClick() {
    try {
      const response = await fetch(
        `${location.protocol}//${hostname}:${AppConfig.port}/api`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "code_review",
            room: AppConfig.roomId,
          }),
        }
      );
      if (response.ok) {
        console.log("Code Review sent successfully");
        const data = await response.json();
        reviewText(data.review);
      }
    } catch (error) {
      console.error("Error Occured with code review:", error);
    }
  }

  return (
    <div
      className="
      flex flex-col md:flex-row
      gap-2 md:gap-5
      text-[#ccc] py-2 text-xs font-fira
    "
    >
      <LanguageSelector
        selected={selectedLang}
        onChange={(lang) => setLanguage(lang)}
      />

      <button
        onClick={run_code}
        className="btn-flat bg-run px-5 py-2 rounded-md border border-Cborder hover:bg-run-hover active:bg-tab-active"
      >
        Run
      </button>

      <button
        onClick={handleReviewClick}
        className="btn-flat bg-white/5 px-5 py-2 rounded-md border border-Cborder active:bg-[#cccccc35]"
      >
        Review&nbsp;Code
      </button>
    </div>
  );
}
export default Toolbar;
