import { useMemo } from 'react';
import heroImg1 from '@/assets/rights-we-have-rights.jpg';
import heroImg2 from '@/assets/rights-hand-in-hand.jpg';

const heroImages = [heroImg1, heroImg2];

const RightsHero = () => {
  const selectedImage = useMemo(() => {
    return heroImages[Math.floor(Math.random() * heroImages.length)];
  }, []);

  return (
    <div className="mx-5 mt-3 mb-5 rounded-2xl overflow-hidden relative h-[200px]">
      <img
        src={selectedImage}
        alt=""
        className="w-full h-full object-cover"
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-foreground/[0.55] via-foreground/[0.45] to-foreground/[0.65]" />
      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-5 pb-6">
        <h2 className="text-[22px] font-semibold text-white leading-tight mb-1.5">
          You have rights
        </h2>
        <p className="text-[14px] text-white/80 leading-relaxed">
          You don't have to figure this out alone
        </p>
      </div>
    </div>
  );
};

export default RightsHero;
