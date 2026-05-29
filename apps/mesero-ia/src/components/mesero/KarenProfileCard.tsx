import { buildWelcomeGreetingText } from "../../lib/welcomeGreeting";

type Props = {
  assistantName: string;
  restaurantName?: string;
  tableLabel?: string | null;
  lastAssistantText?: string;
  onClearConversation?: () => void;
  clearConversationDisabled?: boolean;
};

function defaultGreeting(assistantName: string, restaurantName?: string) {
  return buildWelcomeGreetingText(restaurantName, assistantName);
}

export function KarenProfileCard({
  assistantName,
  restaurantName,
  tableLabel,
  lastAssistantText,
  onClearConversation,
  clearConversationDisabled,
}: Props) {
  const bubble =
    (lastAssistantText ?? "").trim() || defaultGreeting(assistantName, restaurantName);
  const short = bubble.length > 220 ? `${bubble.slice(0, 217).trim()}…` : bubble;

  return (
    <section className="karen-profile-panel flex shrink-0 items-start gap-3 rounded-2xl border border-mesero-line/15 bg-mesero-deep/25 p-4 ring-1 ring-mesero-line/10">
      <div className="relative shrink-0" aria-hidden>
        <div className="relative h-[4.25rem] w-[4.25rem] overflow-hidden rounded-full bg-mesero-muted ring-2 ring-mesero-accent/40">
          <img
            src="/karen-avatar.png"
            alt=""
            className="pointer-events-none absolute left-1/2 top-0 h-[135%] w-[135%] max-w-none -translate-x-1/2 object-cover"
            style={{ objectPosition: "50% 6%" }}
            onError={(e) => {
              const img = e.currentTarget;
              if (img.src.endsWith("/mesero-logo.svg")) return;
              img.src = "/mesero-logo.svg";
              img.className = "h-full w-full object-contain p-2";
              img.style.objectPosition = "";
            }}
          />
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-mesero-bg bg-mesero-active" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-mesero-text">{assistantName}</p>
            <p className="text-[11px] text-mesero-text-muted/75">Tu mesera con IA</p>
          </div>
          {onClearConversation ? (
            <button
              type="button"
              title="Limpiar conversación"
              disabled={clearConversationDisabled}
              onClick={onClearConversation}
              className="touch-manipulation shrink-0 px-0.5 py-0 text-[10px] font-medium leading-tight text-mesero-text-muted/65 underline-offset-2 hover:text-red-300/90 hover:underline disabled:opacity-40"
            >
              Limpiar chat
            </button>
          ) : null}
        </div>
        <p className="mt-2 whitespace-pre-line rounded-xl rounded-tl-sm border border-mesero-line/20 bg-mesero-elevated/90 px-3 py-2.5 text-sm leading-relaxed text-mesero-text/90">
          {short}
        </p>
      </div>
    </section>
  );
}
