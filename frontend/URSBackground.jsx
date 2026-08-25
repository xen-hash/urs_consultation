import bgImage from "./URS_BCKGRND.PNG.png";

/**
 * The campus backdrop, used on the public entry screens.
 *
 * Two things to know about the source image: it is 339x149, and it always sat
 * under a heavy navy overlay. At that size it cannot be a crisp photograph
 * behind a 1920px page — the overlay plus a slight blur is what makes it read
 * as texture rather than as a stretched, pixelated picture. Replacing the file
 * with a larger export is the only way to make it genuinely sharp; the blur can
 * come down accordingly if that happens.
 *
 * The layers are fixed rather than using background-attachment: fixed, which
 * iOS Safari renders incorrectly and janks while scrolling.
 *
 * Signed-in dashboards deliberately do not use this. They are dense, scrolling,
 * data-heavy screens where imagery behind the content costs legibility for
 * nothing.
 */
export default function URSBackground({ children, className = "" }) {
  return (
    <div className={`relative min-h-dvh flex flex-col ${className}`}>
      <div aria-hidden="true" className="fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0 scale-110"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            // Hides the upscaling. The scale-110 above keeps the blurred edges
            // off-screen instead of showing a soft border around the viewport.
            filter: "blur(6px)",
          }}
        />
        <div className="absolute inset-0 bg-brand-900/85" />
        <div className="absolute inset-0 dot-pattern opacity-60" />
      </div>

      <div className="relative z-10 flex flex-col flex-1">{children}</div>
    </div>
  );
}
