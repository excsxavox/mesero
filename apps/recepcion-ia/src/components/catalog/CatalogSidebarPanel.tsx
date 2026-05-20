import { KarenVoiceHero } from "../mesero/KarenVoiceHero";

type ListenProps = {
  assistantName: string;
  listening: boolean;
  busy: boolean;
  ttsActive: boolean;
  supported: boolean;
};

export function CatalogKarenProfile(props: ListenProps) {
  const { assistantName, ...rest } = props;
  return (
    <KarenVoiceHero
      assistantName={assistantName}
      {...rest}
      className="border-0 bg-transparent px-2 py-3 ring-0"
    />
  );
}

/** @deprecated Usa CatalogKarenProfile (incluye estado de voz). */
export function CatalogListeningCard(_props: ListenProps) {
  return null;
}
