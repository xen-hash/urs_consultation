import { Delete } from "lucide-react";

const ROWS = [
  ["1","2","3","4","5","6","7","8","9","0"],
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["Z","X","C","V","B","N","M","-","_"]
];

export default function VirtualKeyboard({ onKey, onDelete, onClear, onEnter }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-4 select-none shadow-2xl">
      {ROWS.map((row, ri) => (
        <div key={ri} className="flex justify-center gap-1.5 mb-1.5">
          {row.map(key => (
            <button
              key={key}
              onMouseDown={e => { e.preventDefault(); onKey(key); }}
              className="w-9 h-10 bg-gray-700 hover:bg-urs-blue active:bg-urs-light text-white text-sm font-semibold rounded-lg transition-all duration-100 active:scale-95 shadow"
            >
              {key}
            </button>
          ))}
        </div>
      ))}
      <div className="flex justify-center gap-1.5 mt-1.5">
        <button
          onMouseDown={e => { e.preventDefault(); onClear?.(); }}
          className="px-4 h-10 bg-gray-600 hover:bg-gray-500 text-white text-xs font-semibold rounded-lg transition-all active:scale-95"
        >
          CLEAR
        </button>
        <button
          onMouseDown={e => { e.preventDefault(); onKey(" "); }}
          className="flex-1 h-10 max-w-[160px] bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-all active:scale-95"
        >
          SPACE
        </button>
        <button
          onMouseDown={e => { e.preventDefault(); onDelete(); }}
          className="w-16 h-10 bg-red-800 hover:bg-red-700 text-white rounded-lg flex items-center justify-center transition-all active:scale-95"
        >
          <Delete size={16} />
        </button>
        <button
          onMouseDown={e => { e.preventDefault(); onEnter?.(); }}
          className="px-4 h-10 bg-green-700 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-all active:scale-95"
        >
          ENTER
        </button>
      </div>
    </div>
  );
}

