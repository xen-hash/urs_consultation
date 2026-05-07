import ursBg from "./URS_BCKGRND.PNG.png";

/**
 * Wraps any page with the URS campus background image
 * and a dark blue overlay for readability.
 * Use instead of <PageWrapper> for full-bleed background pages.
 */
export default function URSBackground({ children, className = "" }) {
  return (
    <div className={`relative min-h-screen flex flex-col ${className}`}>
      {/* Background image layer */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: `url(${ursBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      {/* Dark overlay */}
      <div className="fixed inset-0 z-0" style={{ background: "rgba(0, 25, 70, 0.75)" }} />
      {/* Subtle dot pattern on top */}
      <div className="fixed inset-0 z-0 dot-pattern" />
      {/* Content */}
      <div className="relative z-10 flex flex-col flex-1">
        {children}
      </div>
    </div>
  );
}
