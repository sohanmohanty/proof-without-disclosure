/** The 3D journey: the whole scroll experience, lazy-loaded as one chunk
 * so three.js never touches the main bundle. Layout: a sticky
 * full-viewport canvas with the chapter caption sections scrolling over it
 * (native scroll; nothing is hijacked, keyboard and screen readers see a
 * normal document), and a HUD layer (progress dots, skip, classic link)
 * painted above both. */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import JourneyCanvas from "./JourneyCanvas";
import { CaptionFor, HeroHeader, OutroContent } from "./captions";
import { bindJourney, detectQuality, journey } from "./journeyState";
import { scrollToModules } from "./scroll";
import { activeChapterIndex, CHAPTERS } from "./timeline";

export default function JourneyExperience({
  introActive = false,
}: {
  // owned by Landing (outside this lazy chunk) so the overlay can cover the
  // page before this chunk has even downloaded; passed in only to keep the
  // HUD out of the accessibility tree while the overlay is up
  introActive?: boolean;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(true);
  const [active, setActive] = useState(0);
  // decide the quality tier during render, before the canvas mounts
  useState(() => {
    journey.quality = detectQuality();
  });

  // publish the journey wrapper's own top offset (header + main padding) so
  // the field can start flush with the viewport top instead of that-many
  // pixels low (it snapped up by this amount on the first scroll otherwise).
  // useLayoutEffect + a header ResizeObserver keeps it right across nav wraps.
  useLayoutEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const root = document.documentElement;
    const apply = () => {
      // document-space top of the wrapper, independent of current scroll
      const top = el.getBoundingClientRect().top + window.scrollY;
      root.style.setProperty("--field-pull", `${Math.max(0, top)}px`);
    };
    apply();
    const header = document.querySelector(".site-header");
    const ro = new ResizeObserver(apply);
    if (header) ro.observe(header);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
      root.style.removeProperty("--field-pull");
    };
  }, []);

  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const cleanup = bindJourney(el);
    // stop the render loop entirely once the visitor scrolls past;
    // observers may batch records; only the newest one is current
    const io = new IntersectionObserver((entries) =>
      setRunning(entries[entries.length - 1].isIntersecting),
    );
    io.observe(el);
    const onScroll = () => setActive(activeChapterIndex(journey.targetVh));
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      cleanup();
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const jumpTo = (id: string) => {
    const section = wrapper.current?.querySelector<HTMLElement>(
      `.j-section-${id}`,
    );
    if (!section) return;
    section.scrollIntoView({ behavior: "smooth" });
    section.focus({ preventScroll: true });
  };

  return (
    <>
      <div className="journey" ref={wrapper}>
        <div className="journey-canvas">
          <JourneyCanvas running={running} />
        </div>
        <div className="journey-sections">
          {CHAPTERS.map((c) => (
            <section
              key={c.id}
              className={`j-section j-section-${c.id}`}
              style={{ height: `${c.heightVh}vh` }}
              aria-label={c.title}
              tabIndex={-1}
            >
              {c.id === "hero" ? (
                <HeroHeader />
              ) : c.id === "outro" ? (
                <OutroContent />
              ) : (
                <CaptionFor id={c.id} />
              )}
            </section>
          ))}
        </div>
        {/* HUD: its own layer above the caption sections, after them in the
            DOM so it both paints and tabs last */}
        <div className="journey-hud" aria-hidden={introActive ? true : undefined}>
          {/* fixed-positioned; hidden once the journey leaves the viewport so
              the controls don't float over the module grid below */}
          <div
            className="journey-hud-pin"
            data-gone={running ? undefined : "true"}
          >
            <nav className="j-dots" aria-label="Journey chapters">
              {CHAPTERS.map((c, i) => (
                <button
                  key={c.id}
                  className={i === active ? "on" : ""}
                  onClick={() => jumpTo(c.id)}
                  aria-label={`Go to: ${c.title}`}
                  title={c.title}
                />
              ))}
            </nav>
            <div className="j-corner">
              <Link
                className="j-classic"
                to={{ pathname: "/", search: "?classic=1" }}
              >
                Classic page
              </Link>
              <button className="j-skip" onClick={scrollToModules}>
                Skip the tour ↓
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
