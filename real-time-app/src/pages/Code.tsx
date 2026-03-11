import Textbox from "@/features/editor/components/Textbox";
import OutputBox from "@/features/editor/components/OutputBox";
import Toolbar from "@/features/editor/components/Toolbar";
import OutputToolbar from "@/features/editor/components/OutputToolbar";
import { useRopes } from "@/hooks/useRopes";
import { useState } from "react";
import {
  DEFAULT_EDITOR_SETTINGS,
  type EditorSettings,
} from "@/lib/editorSettings";

type Props = {
  editorSettings?: EditorSettings;
};

function Code({ editorSettings = DEFAULT_EDITOR_SETTINGS }: Props) {
  const [text, updateText, outputText, incomingOp, syncVersion, isSynced] =
    useRopes();
  const [responseText, setReviewText] = useState("");
  const [activeOutput, setActiveOutput] = useState<"terminal" | "review">(
    "terminal"
  );

  return (
    <div className="flex h-[calc(100vh-70px)] flex-col p-[20px]">
      <Toolbar reviewText={setReviewText} />
      <div className="flex w-full flex-1 flex-col md:min-h-0 md:flex-row">
        {/* Input Box */}
        <div className="flex min-h-0 flex-col md:flex-[3] md:overflow-hidden">
          <Textbox
            curText={text}
            setText={updateText}
            incomingOp={incomingOp}
            syncVersion={syncVersion}
            isSynced={isSynced}
            editorSettings={editorSettings}
            id="mainInput"
          />
        </div>

        {/* Output Box */}
        <div className="flex min-h-0 flex-col rounded border-2 border-[#213030] md:flex-[2] md:overflow-hidden md:rounded-l-none md:border-l-0">
          <OutputToolbar
            setActiveOutput={setActiveOutput}
            activeOutput={activeOutput}
          />
          <OutputBox
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
