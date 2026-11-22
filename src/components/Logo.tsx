import React, { useState } from 'react';
import { Terminal } from 'lucide-react';
import { LOGO_URL } from '../constants/defaults';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showText = true }) => {
  const [imgFailed, setImgFailed] = useState(false);

  const imgDimensions =
    size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-24 w-24' : 'h-11 w-11';

  return (
    <div className="flex items-center gap-2.5 shrink-0">
      {!imgFailed ? (
        <img
          src={LOGO_URL}
          alt="RQuizz Logo"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className={`${imgDimensions} rounded-2xl object-contain bg-transparent shrink-0`}
        />
      ) : (
        <div
          className={`${imgDimensions} rounded-2xl bg-sky-500 text-white flex items-center justify-center shrink-0`}
        >
          <Terminal className="w-5 h-5" />
        </div>
      )}
      {showText && (
        <span className="rquizz-wordmark font-bold text-2xl tracking-wide shrink-0 select-none leading-none">
          <span className="text-[#00c2ff]">R</span>
          <span className="text-[#ff3e8a]">Q</span>
          <span className="text-[#ffb01f]">u</span>
          <span className="text-[#00c2ff]">i</span>
          <span className="text-[#ff3e8a]">z</span>
          <span className="text-[#ffb01f]">z</span>
        </span>
      )}
    </div>
  );
};
