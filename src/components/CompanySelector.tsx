import React from 'react';
import { CompanyKey } from '../types';
import { Building2 } from 'lucide-react';
import { IenLogo, SebLogo } from './CompanyLogos';

interface CompanySelectorProps {
  onSelect: (company: CompanyKey) => void;
}

export const CompanySelector: React.FC<CompanySelectorProps> = ({ onSelect }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-6">
      <div className="bg-white rounded-3xl p-8 sm:p-12 w-full max-w-xl shadow-2xl text-center border border-slate-100">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 text-blue-700 rounded-2xl mb-6">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2 tracking-tight">
          Select Company Database
        </h1>
        <p className="text-slate-500 text-sm mb-8">
          Choose which 201 employee database you would like to access
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* IENCC */}
          <button
            onClick={() => onSelect('iencc')}
            className="group relative p-6 border-2 border-slate-200 hover:border-blue-600 rounded-2xl text-left transition-all duration-200 bg-slate-50/50 hover:bg-blue-50/30 hover:shadow-xl hover:-translate-y-1"
          >
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 p-2 flex items-center justify-center mb-4 shadow-xs group-hover:scale-105 transition-transform">
              <IenLogo size={52} />
            </div>
            <h3 className="font-bold text-slate-900 text-lg mb-1 group-hover:text-blue-700 transition-colors">
              Integrated and effective navigation Consultancy Corp
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              3 M. Vicente St. Brgy Malamig Mandaluyong City
            </p>
            <p className="text-[11px] font-mono font-bold text-slate-400 mt-2">
              TIN: 601 157 401 00000
            </p>
          </button>

          {/* SEB */}
          <button
            onClick={() => onSelect('seb')}
            className="group relative p-6 border-2 border-slate-200 hover:border-teal-600 rounded-2xl text-left transition-all duration-200 bg-slate-50/50 hover:bg-teal-50/30 hover:shadow-xl hover:-translate-y-1"
          >
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 p-2 flex items-center justify-center mb-4 shadow-xs group-hover:scale-105 transition-transform">
              <SebLogo size={52} />
            </div>
            <h3 className="font-bold text-slate-900 text-lg mb-1 group-hover:text-teal-700 transition-colors">
              SEB Equipment and Supply Corp
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              3 M. Vicente St. Brgy Malamig Mandaluyong City
            </p>
            <p className="text-[11px] font-mono font-bold text-slate-400 mt-2">
              TIN: 607 097 263 00000
            </p>
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 text-xs text-slate-400">
          201 Employee Management & Document Storage System • Local Storage Ready
        </div>
      </div>
    </div>
  );
};
