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
    size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-20 w-20' : 'h-11 w-11';

  return (
    <div className="flex items-center gap-3 shrink-0">
      {!imgFailed ? (
        <img
          src={LOGO_URL}
          alt="Logo UKK XII TKJ 1 Kuiz Game Challenge"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className={`${imgDimensions} rounded-xl object-cover border border-slate-200 bg-white shadow-xs shrink-0`}
        />
      ) : (
        <div
          className={`${imgDimensions} rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0`}
        >
          <Terminal className="w-5 h-5" />
        </div>
      )}
      {showText && (
        <span className="font-display font-bold text-slate-900 text-lg tracking-tight whitespace-nowrap shrink-0">
          UKK Challenge
        </span>
      )}
    </div>
  );
};
