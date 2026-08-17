import { useScrollReveal } from "./useScrollReveal";

type LandingCtaProps = {
  isAuthenticated: boolean;
  onPrimaryCta: () => void;
};

export default function LandingCta({ isAuthenticated, onPrimaryCta }: LandingCtaProps) {
  const revealRef = useScrollReveal<HTMLDivElement>();

  return (
    <section className="landing-cta">
      <div className="landing-cta-inner landing-reveal" ref={revealRef}>
        <h2 className="landing-cta-title">
          Sẵn sàng rút ngắn thời gian viết Requirement và Test Case?
        </h2>
        <button className="btn btn-primary landing-cta-btn" onClick={onPrimaryCta}>
          {isAuthenticated ? "Vào Dashboard" : "Dùng thử miễn phí"}
        </button>
      </div>
    </section>
  );
}
