import chronicleLogo from '@/assets/chronicle-logo.png';

interface ChronicleLogoProps {
  size?: number;
  className?: string;
}

const ChronicleLogo = ({ size = 48, className = '' }: ChronicleLogoProps) => (
  <img
    src={chronicleLogo}
    alt="Project Chronicle"
    width={size}
    height={size}
    className={`object-contain ${className}`}
    draggable={false}
  />
);

export default ChronicleLogo;
