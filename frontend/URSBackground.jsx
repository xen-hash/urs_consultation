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
    <div className={`surface-fixed-light relative min-h-dvh flex flex-col ${className}`}>
      <div aria-hidden="true"
        className="fixed inset-0 z-0 overflow-hidden
                   [--backdrop-blur:6px] lg:[--backdrop-blur:14px] 2xl:[--backdrop-blur:22px]">
        <div
          className="absolute inset-0 scale-110"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            // Hides the upscaling. The scale-110 above keeps the blurred edges
            // off-screen instead of showing a soft border around the viewport.
            filter: "blur(var(--backdrop-blur, 6px))",
          }}
        />
        {/* Heavier as the window widens. The source is 339px across, so on a
            2000px monitor it is upscaled six-fold — at that size the softening
            that reads as texture on a phone reads as an out-of-focus
            photograph. More blur and a deeper overlay put it back to being a
            surface rather than a picture. */}
        <div className="absolute inset-0 bg-brand-900/85 lg:bg-brand-900/90 2xl:bg-brand-900/[0.93]" />
        <div className="absolute inset-0 dot-pattern opacity-60" />
      </div>

      <div className="relative z-10 flex flex-col flex-1">{children}</div>
    </div>
  );
}
