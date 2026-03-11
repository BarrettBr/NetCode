type Props = {
  setActiveOutput: (val: "terminal" | "review") => void;
  activeOutput: string;
};

/*
  Output Toolbar Component:
    Reusable output Toolbar UI component that lets the user:
      - Select to display output text
      - Select to display code review text

    Props:
      - activeOutput: string
        Used to tell which component to display
      - setActiveOutput: (val: string) => void
        Callback function to set the current tab displayed
*/
function OutputToolbar({ setActiveOutput, activeOutput }: Props) {
  return (
    <div className="flex items-center bg-none text-[#ccc] p-2 border-b border-[#333] text-sm font-fira">
      <ul>
        <li className="flex gap-2">
          <button
            className={
              activeOutput === "terminal"
                ? "py-1 text-white border-b-2 border-[#73e8c4]"
                : "py-1 text-gray-500 hover:text-white/70"
            }
            onClick={() => setActiveOutput("terminal")}
          >
            Terminal
          </button>
          <button
            className={
              activeOutput === "review"
                ? "py-1 text-white border-b-2 border-[#73e8c4]"
                : "py-1 text-gray-500 hover:text-white/70"
            }
            onClick={() => setActiveOutput("review")}
          >
            Review
          </button>
        </li>
      </ul>
    </div>
  );
}

export default OutputToolbar;
