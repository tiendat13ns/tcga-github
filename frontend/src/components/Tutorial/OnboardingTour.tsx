import { Joyride, STATUS, type EventData } from "react-joyride";
import { TOUR_STEPS } from "../../lib/tourSteps";

type OnboardingTourProps = {
  run: boolean;
  onFinish: () => void;
};

// Wrapper mỏng quanh react-joyride, chỉ để tách cấu hình style/behaviour ra khỏi App.tsx.
// Style dùng lại đúng token màu của design system (xem styles.css :root) thay vì theme
// mặc định của thư viện, để tooltip không bị lệch tông với phần còn lại của app.
// LƯU Ý: react-joyride v3 đổi hẳn API so với v2 — không còn `callback`/`showSkipButton`/
// `styles.options`, thay bằng `onEvent` + prop `options` cấp cao nhất (xem type Props/Options
// trong node_modules/react-joyride/dist/index.d.mts).
export default function OnboardingTour({ run, onFinish }: OnboardingTourProps) {
  const handleEvent = (data: EventData) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      onFinish();
    }
  };

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      locale={{
        back: "Quay lại",
        close: "Đóng",
        last: "Hoàn tất",
        next: "Tiếp theo",
        skip: "Bỏ qua",
      }}
      options={{
        buttons: ["back", "close", "primary", "skip"],
        showProgress: true,
        zIndex: 10000,
        arrowColor: "var(--bg-elevated)",
        backgroundColor: "var(--bg-elevated)",
        overlayColor: "rgba(26, 26, 26, 0.55)",
        primaryColor: "var(--accent)",
        textColor: "var(--text-primary)",
      }}
      styles={{
        tooltip: {
          borderRadius: 10,
          fontSize: 13,
        },
        tooltipTitle: {
          fontSize: 15,
          fontWeight: 700,
        },
        buttonPrimary: {
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          padding: "8px 14px",
        },
        buttonBack: {
          fontSize: 12,
          color: "var(--text-secondary)",
        },
        buttonSkip: {
          fontSize: 12,
          color: "var(--text-muted)",
        },
      }}
    />
  );
}
