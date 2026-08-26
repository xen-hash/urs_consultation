import { Link, useLocation } from "react-router-dom";
import { Compass, Home } from "lucide-react";
import URSBackground from "./URSBackground.jsx";
import PortalNav from "./ui/PortalNav.jsx";
import ursLogo from "./URS_LOGO.png";

/**
 * A wrong address, answered rather than swallowed.
 *
 * Anything unrecognised used to redirect silently to the front page. That is
 * indistinguishable from the link having worked and the site having nothing on
 * it: no explanation, no way to tell a typo from a page that moved, and no
 * clue which of the four entrances you actually wanted. This says what
 * happened, quotes the address back so a typo is visible, and lists the ways
 * in.
 */
export default function NotFound() {
  const { pathname } = useLocation();

  return (
    <URSBackground>
      <nav className="sticky top-0 z-30 bg-surface header-blend pt-safe">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3 max-w-4xl mx-auto w-full">
          <img src={ursLogo} alt="" aria-hidden="true" className="w-8 h-8 object-contain shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-sm text-fg truncate">University of Rizal System</p>
            <p className="text-xs text-muted-fg">College of Engineering</p>
          </div>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-xl mx-auto px-4 sm:px-6 flex flex-col justify-center
                       py-10 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="animate-rise">
          <span className="icon-tile w-12 h-12 mb-4 bg-on-backdrop/10 text-on-backdrop">
            <Compass size={24} aria-hidden="true" />
          </span>

          <h1 className="text-title font-bold text-on-backdrop">There's nothing at that address</h1>
          <p className="text-on-backdrop/75 mt-2 leading-relaxed">
            Nothing here answers to{" "}
            <span className="font-mono text-on-backdrop/90 break-all">{pathname}</span>. Check it for
            a typo, or pick where you were heading.
          </p>

          <Link to="/" className="btn btn-secondary mt-6">
            <Home size={16} aria-hidden="true" /> Go to the front page
          </Link>

          <PortalNav current="/" className="mt-8" />
        </div>
      </main>
    </URSBackground>
  );
}
