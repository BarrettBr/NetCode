import Textbox from "@/components/textbox";
import Outputbox from "@/components/outputBox";
import Toolbar from "@/components/Toolbar";
import OutputToolbar from "@/components/OutputToolbar";
import { useRopes } from "@/hooks/useRopes";
import { useState } from "react";

function Code() {
  const [text, updateText, outputText, incomingOp, syncVersion, isSynced] =
    useRopes();
  const [responseText, setReviewText] = useState("");
  const [activeOutput, setActiveOutput] = useState<"terminal" | "review">(
    "terminal"
  );

  return (
    <div className="flex flex-col flex-1 h-[calc(100vh-70px)] md:max-h-screen p-[20px]">
      <Toolbar reviewText={setReviewText} />
      <div className="flex flex-col md:flex-row w-full flex-1 md:min-h-0">
        {/* Input Box */}
        <div className="flex flex-col md:max-h-screen md:flex-[3] md:overflow-hidden">
          <Textbox
            curText={text}
            setText={updateText}
            incomingOp={incomingOp}
            syncVersion={syncVersion}
            isSynced={isSynced}
            id="mainInput"
          />
        </div>

        {/* Output Box */}
        <div className="flex flex-col md:flex-[2] md:overflow-hidden border-2 md:border-l-0 border-[#213030] rounded">
          <OutputToolbar
            setActiveOutput={setActiveOutput}
            activeOutput={activeOutput}
          />
          <Outputbox
            curText={activeOutput === "terminal" ? outputText : responseText}
            activeOutput={activeOutput}
            id="mainOutput"
          />
        </div>
      </div>
    </div>
  );
}
export default Code;
