'use client';

import React, { memo } from 'react';
import { 
  History, BarChart3, Loader2 
} from 'lucide-react';

interface HistoryTabProps {
  history: any[];
  isLoading: boolean;
  onAnalyzeAgain: (url: string) => void;
}

export const HistoryTab = memo(({ history, isLoading, onAnalyzeAgain }: HistoryTabProps) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden will-change-[transform,opacity]">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-bold text-gray-900 uppercase tracking-tight italic">My Search History</h3>
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
      </div>
      <div className="divide-y divide-gray-100">
        {history.length > 0 ? (
          history.map((item) => (
            <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 truncate pr-4">{item.url}</div>
                <div className="text-[10px] text-gray-400 font-mono">
                  {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : 'Just now'}
                </div>
              </div>
              <button
                onClick={() => onAnalyzeAgain(item.url)}
                className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Analyze Again
              </button>
            </div>
          ))
        ) : (
          <div className="p-12 text-center text-gray-400">
            <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>검색 기록이 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
});

HistoryTab.displayName = 'HistoryTab';

interface StatsTabProps {
  stats: any[];
  isLoading: boolean;
}

export const StatsTab = memo(({ stats, isLoading }: StatsTabProps) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden will-change-[transform,opacity]">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
        <h3 className="font-bold text-gray-900 uppercase tracking-tight italic flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          Global URL Top Rankings
        </h3>
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
      </div>
      <div className="divide-y divide-gray-100">
        {stats.length > 0 ? (
          stats.map((stat, idx) => (
            <div key={stat.id} className="px-6 py-5 flex items-start gap-6 hover:bg-gray-50/50 transition-colors">
              <div className="text-3xl font-black text-gray-100 italic w-10 shrink-0 select-none pt-1">
                {String(idx + 1).padStart(2, '0')}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="text-sm font-bold text-gray-900 break-all leading-snug line-clamp-2" title={stat.url}>
                  {stat.url}
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded text-[9px] font-mono tracking-tighter uppercase">
                    ID: {stat.urlKey}
                  </span>
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-center justify-center min-w-[70px] bg-blue-50 px-3 py-2 rounded-xl">
                <div className="text-xl font-black text-blue-600 italic leading-none">{stat.count}</div>
                <div className="text-[9px] font-bold text-blue-400 uppercase tracking-tight mt-1">Scans</div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-16 text-center text-gray-400">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-10" />
            <p className="font-medium">통계 데이터가 아직 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
});

StatsTab.displayName = 'StatsTab';
