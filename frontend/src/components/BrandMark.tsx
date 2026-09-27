import logoEmblem from "../../../img/logo.png.jpeg";

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <img src={logoEmblem} alt="" />
    </span>
  );
}
