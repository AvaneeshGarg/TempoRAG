
import React from 'react';
import { Source } from '../types';
import { LibraryIcon } from './Icons';

interface SourceCardProps {
  source: Source;
}

export const SourceCard: React.FC<SourceCardProps> = ({ source }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="mt-1 bg-slate-100 p-1.5 rounded-md text-slate-500">
          <LibraryIcon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 line-clamp-2 leading-tight">
            {source.title}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span className="bg-slate-100 px-2 py-0.5 rounded-full font-medium">
              Year: {source.year}
            </span>
            <span className="flex items-center gap-1 font-mono text-rose-600 font-bold">
              Score: {source.score.toFixed(3)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
