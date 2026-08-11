type LandingCtaProps = {
  isAuthenticated: boolean;
  onPrimaryCta: () => void;
};

export default function LandingCta({ isAuthenticated, onPrimaryCta }: LandingCtaProps) {
  return (
    <section className="landing-cta">
      <div className="landing-cta-inner">
        <h2 className="landing-cta-title">
          Sẵn sàng rút ngắn thời gian viết Requirement và Test Case?
        </h2>
        <p className="landing-cta-subtitle">
          Bắt đầu miễn phí với 200 Credits — không cần thẻ thanh toán.
        </p>
        <button className="btn btn-primary landing-cta-btn" onClick={onPrimaryCta}>
          {isAuthenticated ? "Vào Dashboard" : "Dùng thử miễn phí"}
        </button>
      </div>
    </section>
  );
}
