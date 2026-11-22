import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 bg-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <span>UKK Challenge · Latihan Persiapan Uji Kompetensi Keahlian</span>
        <span className="font-medium text-slate-700">© Abdul Rokhim - 2026</span>
      </div>
    </footer>
  );
};
