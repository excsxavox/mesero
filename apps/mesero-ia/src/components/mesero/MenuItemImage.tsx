import { useEffect, useState } from "react";
import { menuImageSrc } from "../../lib/menuImage";

type Props = {
  src: string | undefined | null;
  className?: string;
  fallbackClassName?: string;
};

export function MenuItemImage({ src, className = "h-full w-full object-cover", fallbackClassName }: Props) {
  const resolved = menuImageSrc(src);
  const [ok, setOk] = useState(Boolean(resolved));

  useEffect(() => {
    setOk(Boolean(resolved));
  }, [resolved]);

  if (!resolved || !ok) {
    return (
      <div
        className={
          fallbackClassName ??
          "flex h-full w-full items-center justify-center bg-mesero-muted text-2xl text-mesero-accent/40"
        }
      >
        🍽️
      </div>
    );
  }

  return (
    <img
      key={resolved}
      src={resolved}
      alt=""
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setOk(false)}
    />
  );
}
