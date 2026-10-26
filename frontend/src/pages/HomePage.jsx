import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { billLabel, useApi } from "../api.js";
import { ArrowLeft, ArrowRight, SearchIcon } from "../components/Icons.jsx";

const TOPICS = ["healthcare", "immigration", "climate", "taxes", "education", "veterans", "housing"];

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Types out each word, pauses, deletes it, then moves to the next. */
function useTypewriter(words) {
  const [index, setIndex] = useState(0);
  const [len, setLen] = useState(prefersReducedMotion() ? words[0].length : 0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const word = words[index];
    const full = !deleting && len === word.length;
    const empty = deleting && len === 0;
    const delay = full ? 1600 : empty ? 300 : deleting ? 35 : 85;

    const t = setTimeout(() => {
      if (full) setDeleting(true);
      else if (empty) {
        setDeleting(false);
        setIndex((index + 1) % words.length);
      } else setLen(len + (deleting ? -1 : 1));
    }, delay);
    return () => clearTimeout(t);
  }, [words, index, len, deleting]);

  return words[index].slice(0, len);
}

function HeroSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const topic = useTypewriter(TOPICS);

  return (
    <form
      className="hero-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        navigate(q.trim() ? `/bills?q=${encodeURIComponent(q.trim())}` : "/bills");
      }}
    >
      <SearchIcon className="hero-search-icon" width={26} height={26} />
      <div className="hero-search-field">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search legislation"
        />
        {!q && (
          <span className="hero-search-placeholder" aria-hidden="true">
            Find legislation on <em>{topic}</em>
          </span>
        )}
      </div>
      <button type="submit" className="hero-search-btn">
        <span className="long">Start your search</span>
        <span className="short">Search</span>
      </button>
    </form>
  );
}

function LatestBills() {
  const { data, error } = useApi("/bills", { limit: 12 });
  const bills = data?.bills ?? [];
  const trackRef = useRef(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const step = () => {
    const track = trackRef.current;
    const card = track?.querySelector(".bill-card");
    return card ? card.offsetWidth + parseFloat(getComputedStyle(track).columnGap || 0) : 1;
  };
  const atEnd = () => {
    const t = trackRef.current;
    return t.scrollLeft + t.clientWidth >= t.scrollWidth - 4;
  };
  const scrollToIndex = (i) => trackRef.current?.scrollTo({ left: i * step(), behavior: "smooth" });

  const next = () => (atEnd() ? scrollToIndex(0) : scrollToIndex(active + 1));
  const prev = () =>
    active === 0 ? trackRef.current.scrollTo({ left: trackRef.current.scrollWidth, behavior: "smooth" }) : scrollToIndex(active - 1);

  const onScroll = () => setActive(atEnd() ? bills.length - 1 : Math.round(trackRef.current.scrollLeft / step()));

  // Auto-advance every 5s unless the user is hovering/focused inside or prefers reduced motion.
  useEffect(() => {
    if (paused || !bills.length || prefersReducedMotion()) return;
    const id = setInterval(next, 5000);
    return () => clearInterval(id);
  });

  return (
    <section className="latest">
      <h2 className="latest-title">Latest from Congress</h2>
      {error && <p className="error center">{error.message}</p>}

      <div
        ref={trackRef}
        className="latest-track"
        onScroll={onScroll}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        {!data && !error &&
          Array.from({ length: 4 }, (_, i) => <div key={i} className="bill-card skeleton" />)}
        {bills.map((b, i) => (
          <Link
            key={`${b.type}${b.number}`}
            to={`/bills/${b.congress}/${b.type}/${b.number}`}
            className={`bill-card${i === active ? " is-active" : ""}`}
          >
            <span className="bill-card-stripe" />
            <div className="bill-card-body">
              <span className="bill-card-meta">
                {billLabel(b)} · Introduced {b.introducedDate}
              </span>
              <h3>{b.title}</h3>
              {b.latestAction && (
                <p>
                  <span className="bill-card-date">Latest action · {b.latestAction.actionDate}</span>
                  {b.latestAction.text}
                </p>
              )}
              <span className="bill-card-cta">
                Read the bill <ArrowRight />
              </span>
            </div>
          </Link>
        ))}
      </div>

      {bills.length > 0 && (
        <div className="latest-controls">
          <div className="latest-arrows">
            <button type="button" onClick={prev} aria-label="Previous bills"><ArrowLeft /></button>
            <button type="button" onClick={next} aria-label="Next bills"><ArrowRight /></button>
          </div>
          <div className="latest-progress" aria-hidden="true">
            {bills.map((b, i) => (
              <span key={`${b.type}${b.number}`} className={i === active ? "on" : ""} />
            ))}
          </div>
        </div>
      )}

      <p className="center">
        <Link to="/bills" className="see-all">Browse all bills <ArrowRight width={18} height={18} /></Link>
      </p>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-photo" />
        <div className="hero-veil" />
        <div className="hero-veil hero-veil-corner" />
        <div className="hero-content">
          <h1 className="hero-title">
            <span className="hero-title-soft">Your home for</span>
            <span>legislation in Congress</span>
          </h1>
          <HeroSearch />
          <p className="hero-caption">
            Bills, sponsors and legislative actions from the 119th Congress — sourced from the official Congress.gov API.
          </p>
        </div>
      </section>
      <LatestBills />
    </>
  );
}
