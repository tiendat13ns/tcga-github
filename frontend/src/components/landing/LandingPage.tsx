import "./landing.css";
import LandingHeader from "./LandingHeader";
import LandingHero from "./LandingHero";
import LandingPainPoints from "./LandingPainPoints";
import LandingProduct from "./LandingProduct";
import LandingRagPipeline from "./LandingRagPipeline";
import LandingHowItWorks from "./LandingHowItWorks";
import LandingFeatures from "./LandingFeatures";
import LandingWhoItsFor from "./LandingWhoItsFor";
import LandingUsage from "./LandingUsage";
import LandingFaq from "./LandingFaq";
import LandingCta from "./LandingCta";
import LandingFooter from "./LandingFooter";

type LandingPageProps = {
  isAuthenticated: boolean;
  onGoToLogin: () => void;
  onGoToRegister: () => void;
  onGoToDashboard: () => void;
  onGoToWhatsNew?: () => void;
};

export default function LandingPage({ isAuthenticated, onGoToLogin, onGoToRegister, onGoToDashboard, onGoToWhatsNew }: LandingPageProps) {
  const primaryCta = isAuthenticated ? onGoToDashboard : onGoToRegister;

  return (
    <div className="landing-page">
      <LandingHeader
        isAuthenticated={isAuthenticated}
        onGoToLogin={onGoToLogin}
        onGoToRegister={onGoToRegister}
        onGoToDashboard={onGoToDashboard}
      />
      <main>
        <LandingHero isAuthenticated={isAuthenticated} onPrimaryCta={primaryCta} />
        <LandingPainPoints />
        <LandingProduct />
        <LandingRagPipeline />
        <LandingHowItWorks />
        <LandingFeatures />
        <LandingWhoItsFor />
        <LandingUsage isAuthenticated={isAuthenticated} onPrimaryCta={primaryCta} />
        <LandingFaq />
        <LandingCta isAuthenticated={isAuthenticated} onPrimaryCta={primaryCta} />
      </main>
      <LandingFooter onGoToWhatsNew={onGoToWhatsNew} />
    </div>
  );
}
