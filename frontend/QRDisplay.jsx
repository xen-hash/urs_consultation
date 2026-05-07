import { useRef } from "react";
import { Download, QrCode } from "lucide-react";

export default function QRDisplay({ base64, label, filename = "qrcode.png" }) {
  const imgRef = useRef(null);

  if (!base64) return null;

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${base64}`;
    link.download = filename;
    link.click();
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-gradient-to-b from-blue-50 to-white rounded-2xl border border-blue-100">
      <div className="flex items-center gap-2 text-urs-blue">
        <QrCode size={20} />
        <span className="font-display font-semibold text-sm">Your QR Code</span>
      </div>
      <div className="p-3 bg-white rounded-xl shadow-md border border-gray-100">
        <img
          ref={imgRef}
          src={`data:image/png;base64,${base64}`}
          alt="QR Code"
          className="w-48 h-48 object-contain"
        />
      </div>
      {label && (
        <p className="text-center text-sm font-semibold text-gray-700">{label}</p>
      )}
      <p className="text-xs text-gray-500 text-center max-w-xs">
        Save this QR code — use it to log in quickly next time. Screenshot or download it now.
      </p>
      <button
        onClick={handleDownload}
        className="flex items-center gap-2 btn-primary text-sm py-2.5 px-5"
      >
        <Download size={16} />
        Download QR Code
      </button>
    </div>
  );
}
