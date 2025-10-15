import { useEffect, useRef, useState } from "react";
import type { RopeOperation } from "@/hooks/useRopes";
import LineNum from "@/components/LineNum";

type Props = {
  curText: string;
  setText: (
    value: string,
    forceTab?: {
      force: boolean;
      start: number;
      end: number;
      replacement: string;
    }
  ) => void;
  incomingOp: RopeOperation[];
  id: string;
};

/*
  Textbox Component:
    Reusable Textbox component that lets someone:
      - Enter text to a textbox
      - Sync requests the text with the backend
      - Retrieve text updates from the backend

    Props:
      - curText: string
        A string that when called to retrieves the current text inputted in the textbox
      - setText: (value: string) => void
        A callback function used to update the textbox when typing
      - incomingOp: RopeOperation | null
        A RopeOperation that declares if the most recent change was an update or a delete and the position of it, used for cursor management

    Functions:
      - handleInput: Handles when the user enters & changes the textbox through DOM manipulation
      - useEffect: Handles when someone else changes the DOM element

    Dependencies:
      - No outside dependencies outside of passed Props
*/
function Textbox({ curText, setText, incomingOp, id }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastTextRef = useRef<string>(""); // Keep last known value
  const cursorRef = useRef<number>(0); // Keep cursor position
  const lineNumRef = useRef<HTMLDivElement>(null);
  const skipNextEffect = useRef(false);
  const [numLines, setNumLines] = useState(1);

  const updateLines = (codecontent: string) => {
    const newLines = codecontent.split("\n").length;
    setNumLines(newLines);
  };

  // Used to handle tabbing
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      let newValue: string;
      let updatedStart = start;
      let updatedEnd = end;

      /*
      console.log(`Start: ${start}`);
      console.log(`end: ${end}`);
      console.log(`updatedStart: ${updatedStart}`);
      console.log(`updatedEnd: ${updatedEnd}`);
      */

      let replacement = "    ";

      if (start === end) {
        // Single tab insert
        newValue = curText.slice(0, start) + "    " + curText.slice(end);
        updatedStart = updatedEnd = start + replacement.length;
        skipNextEffect.current = true;
        setText(newValue, {
          force: true,
          start: start,
          end: end,
          replacement,
        });
      } else {
        // Multi-line tab
        const fullText = curText;
        const lineStart = fullText.lastIndexOf("\n", start - 1) + 1;
        const before = fullText.slice(0, lineStart);
        const selected = fullText.slice(lineStart, end);
        const after = fullText.slice(end);

        const lines = selected.split("\n");
        const tabbed = lines.map((line) => replacement + line).join("\n");

        newValue = before + tabbed + after;
        // Keep entire block selected
        updatedStart = lineStart;
        updatedEnd = lineStart + tabbed.length;

        // Debug Comments
        /*
        console.log(`fullText: ${fullText}`);
        console.log(`lineStart: ${lineStart}`);
        console.log(`before: ${before}`);
        console.log(`selected: ${selected}`);
        console.log(`after: ${after}`);
        console.log(`lines: ${lines}`);
        console.log(`tabbed: ${tabbed}`);
        console.log(`newValue: ${newValue}`);
        console.log(`updatedStart: ${updatedStart}`);
        console.log(`updatedEnd: ${updatedEnd}`);
        */
        skipNextEffect.current = true;
        setText(newValue, {
          force: true,
          start: start,
          end: end,
          replacement: tabbed,
        });
      }

      // Update state
      textarea.value = newValue;
      lastTextRef.current = newValue;
      updateLines(newValue);

      // Restore cursor after React updates
      requestAnimationFrame(() => {
        if (!textareaRef.current) return;
        textareaRef.current.selectionStart = updatedStart;
        textareaRef.current.selectionEnd = updatedEnd;
      });
    }
  };

  // Used to handle user-inputted changes
  const handleInput = () => {
    // Grab the textarea DOM element
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Height/width adjustment for fitting in div
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
    textarea.style.width = "auto";
    textarea.style.width = `${textarea.scrollWidth}px`;

    // Grad current value from DOM and save where cursor is
    const newText = textarea.value;
    cursorRef.current = textarea.selectionStart ?? 0;

    // Only update text changed
    if (newText !== lastTextRef.current) {
      setText(newText);
      lastTextRef.current = newText;
      updateLines(newText);
    }
  };

  // Used to sync scrolling of lineNum + code div
  const handleScroll = () => {
    if (!lineNumRef.current || !wrapperRef.current) return;
    lineNumRef.current.scrollTop = wrapperRef.current.scrollTop;
  };

  // Used to handle incoming changes
  useEffect(() => {
    // Get current DOM element
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Only update it if the text is different
    if (curText !== lastTextRef.current) {
      if (skipNextEffect.current) {
        skipNextEffect.current = false;
        return;
      }
      // Grab cursor, update text and restore cursor
      let currentCursor = textarea.selectionStart ?? 0;
      while (incomingOp.length > 0) {
        var headOp = incomingOp.shift();
        if (!headOp) return;
        if (headOp.type === "insert" && headOp.pos <= currentCursor) {
          currentCursor += headOp.value.length;
        } else if (headOp.type === "delete") {
          if (headOp.to <= currentCursor) {
            currentCursor -= headOp.to - headOp.from;
          } else if (headOp.from < currentCursor && currentCursor < headOp.to) {
            currentCursor = headOp.from;
          }
        }
      }

      textarea.value = curText;
      lastTextRef.current = curText;

      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
      textarea.style.width = "auto";
      textarea.style.width = `${textarea.scrollWidth}px`;

      textarea.setSelectionRange(currentCursor, currentCursor);
      updateLines(curText);
    }
  }, [curText, incomingOp]);

  return (
    <div className="flex max-h-[calc(100vh-9.2rem)] h-full flex-row border-2 border-[#213030] rounded">
      <div
        className="flex flex-row w-full overflow-y-auto custom-scroll scroll-stable"
        ref={wrapperRef}
        onScroll={handleScroll}
      >
        <LineNum lineCount={numLines} scrollRef={lineNumRef} />
        <div className="flex flex-1 h-full scroll-stable">
          <textarea
            id={id}
            ref={textareaRef}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Enter your text here"
            className="textbox flex-1 font-fira min-h-[calc(100vh-25rem)] overflow-y-hidden custom-scroll"
            wrap="off"
          />
        </div>
      </div>
    </div>
  );
}
export default Textbox;
