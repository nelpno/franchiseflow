/**
 * Material Symbols Outlined icon component.
 * Uses Google's Material Symbols font (same as Stitch designs).
 *
 * @param {string} icon - Material Symbol name (e.g., "dashboard", "shopping_cart")
 * @param {boolean} filled - Whether to use filled variant
 * @param {string} className - Additional CSS classes
 * @param {number} size - Font size in px (default: 20)
 */
export default function MaterialIcon({ icon, filled = false, className = "", size, style = {} }) {
  const variationSettings = filled
    ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
    : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24";

  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        fontVariationSettings: variationSettings,
        ...(size ? { fontSize: `${size}px` } : {}),
        ...style,
      }}
    >
      {icon}
    </span>
  );
}
