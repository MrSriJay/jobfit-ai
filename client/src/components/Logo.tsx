import logo from "../assets/logo.png";

export function Logo({ size = 40 }: { size?: number }) {
  return <img className="logo" src={logo} alt="" style={{ height: size }} />;
}
