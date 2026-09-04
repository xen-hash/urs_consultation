/**
 * Rizzy — the URS Consultation mascot.
 *
 * The artwork is cut from the character sheet in design/rizzy-sheet.png, which
 * stays out of frontend/public deliberately: it is 2 MB of source art and
 * shipping it would put it in the service worker's precache alongside the
 * six assets that are actually used.
 *
 * Poses are named for the moment they belong to rather than the emotion they
 * show, so a call site reads as the situation rather than a stage direction:
 *
 *   helpful   the default. Guiding, explaining, standing beside empty space.
 *   thinking  waiting on something outside the reader's hands.
 *   excited   something went the reader's way.
 *   happy     a plain friendly greeting.
 *   working   something is broken or missing, and is being looked at.
 *   hero      full figure, for the landing page only.
 *
 * Every instance is decorative unless given a `label`. Rizzy repeats whatever
 * the text beside them already says, and a screen reader announcing "mascot" on
 * every empty state is noise, so the default is an empty alt.
 */

// Intrinsic aspect ratios, so width and height are both set on the element and
// the page does not reflow as each image arrives.
const POSES = {
  helpful:  { src: "/mascot/rizzy-helpful.png",  ratio: 1 },
  happy:    { src: "/mascot/rizzy-happy.png",    ratio: 1 },
  thinking: { src: "/mascot/rizzy-thinking.png", ratio: 1 },
  excited:  { src: "/mascot/rizzy-excited.png",  ratio: 1 },
  working:  { src: "/mascot/rizzy-working.png",  ratio: 448 / 340 },
  hero:     { src: "/mascot/rizzy-hero.png",     ratio: 904 / 300 },
};

const SIZES = { xs: 36, sm: 56, md: 88, lg: 128, xl: 200 };

export default function Mascot({
  pose = "helpful",
  size = "md",
  label,
  priority = false,
  className = "",
}) {
  const { src, ratio } = POSES[pose] || POSES.helpful;
  const w = SIZES[size] || SIZES.md;

  return (
    <img
      src={src}
      alt={label || ""}
      // A decorative image with an empty alt is already skipped by screen
      // readers; this stops it being announced as an unlabelled graphic in the
      // handful that do not honour that.
      aria-hidden={label ? undefined : "true"}
      width={w}
      height={Math.round(w * ratio)}
      // The landing hero is above the fold and should not wait for the
      // observer; everything else can arrive when it is scrolled to.
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable="false"
      className={`shrink-0 select-none ${className}`}
      style={{ width: w, height: "auto" }}
    />
  );
}
