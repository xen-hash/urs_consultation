// FaceOverlay.jsx — Enhanced animated SVG face + eye detection overlay
// Props:
//   detection     = { detected, bbox, eyes }   — from /api/detect
//   videoWidth    — pixel width  of the video element
//   videoHeight   — pixel height of the video element
//   phase         — optional: "idle"|"detecting"|"face_ok"|"eye_check"|"success"|"fail"

export default function FaceOverlay({
  detection,
  videoWidth  = 640,
  videoHeight = 480,
  phase       = "detecting",
}) {
  if (!detection?.detected) return null;

  const { bbox, eyes = [] } = detection;

  // ── Color palette keyed on phase ──────────────────────────────────────────
  const faceColor =
    phase === "success"   ? "#22c55e"
    : phase === "fail"    ? "#ef4444"
    : phase === "eye_check" ? "#60a5fa"
    : "#22c55e";               // default green while detecting

  const eyeColor =
    phase === "success"   ? "#22c55e"
    : phase === "fail"    ? "#ef4444"
    : "#38bdf8";               // sky-blue while scanning

  const scanColor = faceColor;

  // ── Normalised → pixel helpers ────────────────────────────────────────────
  const px = v => v * videoWidth;
  const py = v => v * videoHeight;

  // Face box geometry
  const bx = bbox ? px(bbox.x)      : 0;
  const by = bbox ? py(bbox.y)      : 0;
  const bw = bbox ? px(bbox.width)  : 0;
  const bh = bbox ? py(bbox.height) : 0;
  const cl = Math.min(bw, bh) * 0.18;  // corner bracket length

  // Corner positions: [x, y, hDir, vDir]
  const corners = [
    [bx,      by,      1,  1],
    [bx + bw, by,     -1,  1],
    [bx,      by + bh, 1, -1],
    [bx + bw, by + bh,-1, -1],
  ];

  // Eye ring radii
  const R_INNER = 18;
  const R_MID   = 30;
  const R_OUTER = 42;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={videoWidth}
      height={videoHeight}
      viewBox={`0 0 ${videoWidth} ${videoHeight}`}
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    >
      <defs>

        {/* Scanning beam gradient */}
        <linearGradient id="beamGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={scanColor} stopOpacity="0"   />
          <stop offset="40%"  stopColor={scanColor} stopOpacity="0.5" />
          <stop offset="60%"  stopColor={scanColor} stopOpacity="0.5" />
          <stop offset="100%" stopColor={scanColor} stopOpacity="0"   />
        </linearGradient>

        {/* Corner bracket glow filter */}
        <filter id="bracketGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Eye glow filter */}
        <filter id="eyeGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Clip to face box for scan beam */}
        <clipPath id="faceClip">
          <rect x={bx} y={by} width={bw} height={bh} />
        </clipPath>
      </defs>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* FACE BOUNDING BOX                                                    */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {bbox && (
        <g>

          {/* 1. Ghost rect — very faint fill to show the zone */}
          <rect
            x={bx} y={by} width={bw} height={bh}
            fill={faceColor} fillOpacity="0.04"
            stroke={faceColor} strokeWidth="1" strokeOpacity="0.2"
            rx="6"
          />

          {/* 2. Vertical scan beam — sweeps top→bottom */}
          <rect
            x={bx} y={by}
            width={bw} height={bh * 0.18}
            fill="url(#beamGrad)"
            clipPath="url(#faceClip)"
          >
            <animate
              attributeName="y"
              from={by - bh * 0.18}
              to={by + bh}
              dur="1.6s"
              repeatCount="indefinite"
            />
          </rect>

          {/* 3. Horizontal scan line (thin bright line in beam centre) */}
          <line
            x1={bx} y1={by} x2={bx + bw} y2={by}
            stroke={scanColor} strokeWidth="1.5" strokeOpacity="0.7"
            clipPath="url(#faceClip)"
          >
            <animate
              attributeName="y1"
              from={by} to={by + bh}
              dur="1.6s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="y2"
              from={by} to={by + bh}
              dur="1.6s"
              repeatCount="indefinite"
            />
          </line>

          {/* 4. Corner brackets */}
          <g filter="url(#bracketGlow)">
            {corners.map(([cx, cy, hd, vd], i) => (
              <g key={i}>
                {/* Horizontal arm */}
                <line
                  x1={cx} y1={cy}
                  x2={cx + hd * cl} y2={cy}
                  stroke={faceColor} strokeWidth="3.5" strokeLinecap="round"
                />
                {/* Vertical arm */}
                <line
                  x1={cx} y1={cy}
                  x2={cx} y2={cy + vd * cl}
                  stroke={faceColor} strokeWidth="3.5" strokeLinecap="round"
                />
                {/* Pulsing corner dot */}
                <circle cx={cx} cy={cy} r="4" fill={faceColor}>
                  <animate
                    attributeName="r"
                    values="3;6;3"
                    dur="1.8s"
                    begin={`${i * 0.35}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="1;0.25;1"
                    dur="1.8s"
                    begin={`${i * 0.35}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            ))}
          </g>

          {/* 5. Face centre crosshair */}
          {(() => {
            const cx = bx + bw / 2;
            const cy = by + bh / 2;
            const arm = 12;
            return (
              <g opacity="0.3">
                <line x1={cx - arm} y1={cy} x2={cx + arm} y2={cy}
                  stroke={faceColor} strokeWidth="1.5" />
                <line x1={cx} y1={cy - arm} x2={cx} y2={cy + arm}
                  stroke={faceColor} strokeWidth="1.5" />
                <circle cx={cx} cy={cy} r="3" fill="none" stroke={faceColor} strokeWidth="1.5" />
              </g>
            );
          })()}

        </g>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* EYE OVERLAYS                                                          */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {eyes.map((eye, i) => {
        const ex = px(eye.x);
        const ey = py(eye.y);
        // Rotating arc: half circumference dashes
        const arcCirc = 2 * Math.PI * (R_MID - 3);
        const dashLen = arcCirc * 0.35;

        return (
          <g key={i} filter="url(#eyeGlow)">

            {/* Outer pulsing ring */}
            <circle
              cx={ex} cy={ey} r={R_OUTER}
              fill="none"
              stroke={eyeColor} strokeWidth="1"
              opacity="0.18"
            >
              <animate attributeName="r"
                values={`${R_OUTER};${R_OUTER + 8};${R_OUTER}`}
                dur="2.2s" begin={`${i * 0.5}s`} repeatCount="indefinite" />
              <animate attributeName="opacity"
                values="0.18;0.04;0.18"
                dur="2.2s" begin={`${i * 0.5}s`} repeatCount="indefinite" />
            </circle>

            {/* Mid static ring */}
            <circle
              cx={ex} cy={ey} r={R_MID}
              fill="none"
              stroke={eyeColor} strokeWidth="1.2"
              opacity="0.35"
            />

            {/* Rotating dashed arc */}
            <circle
              cx={ex} cy={ey} r={R_MID - 3}
              fill="none"
              stroke={eyeColor} strokeWidth="2"
              strokeDasharray={`${dashLen} ${arcCirc - dashLen}`}
              strokeLinecap="round"
              opacity="0.75"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from={`0 ${ex} ${ey}`}
                to={`360 ${ex} ${ey}`}
                dur={i === 0 ? "2.4s" : "3.1s"}
                repeatCount="indefinite"
              />
            </circle>

            {/* Counter-rotating short arc */}
            <circle
              cx={ex} cy={ey} r={R_MID - 3}
              fill="none"
              stroke={eyeColor} strokeWidth="1.5"
              strokeDasharray={`${dashLen * 0.4} ${arcCirc - dashLen * 0.4}`}
              strokeLinecap="round"
              opacity="0.4"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from={`0 ${ex} ${ey}`}
                to={`-360 ${ex} ${ey}`}
                dur="4s"
                repeatCount="indefinite"
              />
            </circle>

            {/* Inner iris ring */}
            <circle
              cx={ex} cy={ey} r={R_INNER}
              fill={`${eyeColor}18`}
              stroke={eyeColor} strokeWidth="2"
              opacity="0.85"
            />

            {/* Crosshair lines */}
            <line
              x1={ex - R_MID - 6} y1={ey}
              x2={ex + R_MID + 6} y2={ey}
              stroke={eyeColor} strokeWidth="1" opacity="0.3"
            />
            <line
              x1={ex} y1={ey - R_MID - 6}
              x2={ex} y2={ey + R_MID + 6}
              stroke={eyeColor} strokeWidth="1" opacity="0.3"
            />

            {/* Pupil dot — pulsing */}
            <circle cx={ex} cy={ey} r="4.5" fill={eyeColor}>
              <animate
                attributeName="r"
                values="3.5;6;3.5"
                dur="1.2s"
                begin={`${i * 0.4}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="1;0.5;1"
                dur="1.2s"
                begin={`${i * 0.4}s`}
                repeatCount="indefinite"
              />
            </circle>

            {/* Eye label */}
            <text
              x={ex}
              y={ey - R_OUTER - 6}
              textAnchor="middle"
              fill={eyeColor}
              fontSize="9"
              fontWeight="700"
              fontFamily="monospace"
              opacity="0.7"
              letterSpacing="1"
            >
              {i === 0 ? "LEFT EYE" : "RIGHT EYE"}
            </text>

          </g>
        );
      })}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* STATUS LABEL (top-right of face box)                                 */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {bbox && (
        <g>
          <rect
            x={bx + bw - 86} y={by - 26}
            width={86} height={20}
            rx="5"
            fill={faceColor} fillOpacity="0.15"
            stroke={faceColor} strokeWidth="1" strokeOpacity="0.5"
          />
          <text
            x={bx + bw - 43} y={by - 12}
            textAnchor="middle"
            fill={faceColor}
            fontSize="9"
            fontWeight="800"
            fontFamily="monospace"
            letterSpacing="1.5"
          >
            {phase === "success" ? "✓ CONFIRMED"
              : phase === "fail"    ? "✗ NO MATCH"
              : eyes.length >= 2    ? "FACE + EYES"
              : "SCANNING"}
          </text>
        </g>
      )}

    </svg>
  );
}

