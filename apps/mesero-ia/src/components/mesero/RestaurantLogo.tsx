type Props = {
  className?: string;
  size?: number;
};

export const RESTAURANT_LOGO_SRC = "/restaurant-logo.png";

export function RestaurantLogo({ className = "", size = 44 }: Props) {
  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-xl ring-1 ring-mesero-line/20 shadow-lg shadow-mesero-deep/40 ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={RESTAURANT_LOGO_SRC}
        alt="Logo del restaurante"
        width={size}
        height={size}
        className="h-full w-full object-cover"
        draggable={false}
      />
    </span>
  );
}
