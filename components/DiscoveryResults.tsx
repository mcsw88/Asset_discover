'use client';

import React, { memo } from 'react';
import { 
  AlertCircle, ExternalLink, Play, Image as ImageIcon, 
  Hash, Search 
} from 'lucide-react';
import { motion } from 'motion/react';

interface DiscoveryResultsProps {
  result: any;
}

const DiscoveryAssetGrid = memo(({ allAssets }: { allAssets: any[] }) => {
  if (!allAssets || allAssets.length <= 1) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-indigo-500" />
          Multi-Asset Discovery ({allAssets.length})
        </h4>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {allAssets.slice(0, 4).map((asset: any, i: number) => (
          <div key={i} className={`group relative aspect-square rounded-xl overflow-hidden border bg-gray-50 transition-all shadow-sm ${
            asset.scope === 'likely_child' ? 'border-indigo-300 ring-1 ring-indigo-100' :
            asset.scope === 'in_post' ? 'border-emerald-300 ring-1 ring-emerald-100' :
            asset.scope === 'out_of_post' ? 'opacity-40 grayscale border-gray-200' :
            'border-gray-200'
          }`}>
            {asset.imageUrl ? (
              <img 
                src={asset.imageUrl} 
                alt={`Asset ${i + 1}`} 
                className="object-cover w-full h-full group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <ImageIcon className="w-6 h-6 mb-1 opacity-20" />
                <span className="text-[10px] font-bold uppercase">No URL</span>
              </div>
            )}
            <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 text-white text-[9px] font-bold rounded backdrop-blur-sm flex items-center gap-1">
              #{i + 1}
              <span className={`w-1.5 h-1.5 rounded-full ${
                asset.scope === 'likely_child' ? 'bg-indigo-400' :
                asset.scope === 'in_post' ? 'bg-emerald-400' :
                asset.scope === 'out_of_post' ? 'bg-gray-400' : 'bg-gray-200'
              }`} />
            </div>
            {asset.assetType === 'video' && (
              <div className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full shadow-lg">
                <Play className="w-2 h-2 fill-current" />
              </div>
            )}
            <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="text-[8px] text-white font-mono truncate">{asset.sourceHint}</div>
              <div className="text-[7px] text-gray-300 font-bold uppercase tracking-wider">{asset.scope}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-indigo-400" /> Likely Child
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400" /> In Post
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-gray-400" /> Out of Post
        </div>
      </div>
    </div>
  );
});

DiscoveryAssetGrid.displayName = 'DiscoveryAssetGrid';

const DiscoveryEngineDetails = memo(({ discovery }: { discovery: any }) => {
  if (!discovery) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Search className="w-4 h-4 text-blue-500" />
          Discovery Engine Candidates
        </h4>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-400 font-mono">
            {discovery.debug.timingMs}ms
          </span>
        </div>
      </div>

      {discovery.debug.decisions && discovery.debug.decisions.length > 0 && (
        <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-[10px] text-amber-800 font-mono space-y-1">
          <div className="font-bold uppercase text-amber-600 mb-1">Engine Decisions:</div>
          {discovery.debug.decisions.map((d: string, i: number) => (
            <div key={i}>» {d}</div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto border border-gray-100 rounded-xl">
        <table className="min-w-full divide-y divide-gray-200 text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Kind</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Value / Path</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wider">Score</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wider">Conf.</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {discovery.candidates.slice(0, 15).map((c: any, i: number) => (
              <tr key={i} className={`hover:bg-gray-50 transition-colors ${c.isBoilerplate ? 'opacity-50 grayscale' : ''}`}>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    c.kind === 'video' ? 'bg-red-100 text-red-700' :
                    c.kind === 'image' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {c.kind}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-gray-900 truncate max-w-[250px]" title={c.value}>{c.value}</div>
                  <div className="text-[9px] text-gray-400 font-mono truncate">{c.source} » {c.path}</div>
                </td>
                <td className="px-3 py-2 text-right font-mono font-bold text-gray-900">{c.score}</td>
                <td className="px-3 py-2 text-right">
                  <span className="font-bold text-gray-700">{Math.round(c.confidence * 100)}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

DiscoveryEngineDetails.displayName = 'DiscoveryEngineDetails';

const DiscoveryTravelContext = memo(({ data }: { data: any }) => {
  if (!data) return null;
  
  const renderFacet = (title: string, items: any[], colorClass: string) => {
    if (!items || items.length === 0) return null;
    return (
      <div>
        <div className="text-xs font-semibold text-gray-500 mb-1">{title}</div>
        <div className="flex flex-wrap gap-1.5">
          {items.map((item: any, i: number) => (
            <div key={i} className={`inline-flex flex-col px-2 py-1 rounded-md text-xs border ${colorClass}`}>
              <span className="font-bold">{item.label}</span>
              <span className="text-[10px] opacity-75 truncate max-w-[120px]">&quot;{item.matches[0]}&quot;</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl space-y-4">
      <h4 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
        Travel Context Analysis
      </h4>
      <div className="space-y-3">
        {renderFacet("Place Identity", data.placeIdentities, "bg-orange-50 text-orange-700 border-orange-200")}
        {renderFacet("Features", data.features, "bg-teal-50 text-teal-700 border-teal-200")}
        {renderFacet("Experiences", data.experiences, "bg-pink-50 text-pink-700 border-pink-200")}
        {renderFacet("Conditions", data.conditions, "bg-indigo-50 text-indigo-700 border-indigo-200")}
      </div>
    </div>
  );
});

DiscoveryTravelContext.displayName = 'DiscoveryTravelContext';

export const DiscoveryResults = memo(({ result }: DiscoveryResultsProps) => {
  if (!result) return null;

  return (
    <div className="bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden will-change-transform">
      <div className="px-6 py-5 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-medium leading-6 text-gray-900">Discovery Results</h3>
          <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs font-bold uppercase tracking-wider">
            {result.platform}
          </span>
        </div>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          result.fetch_status === 'success' ? 'bg-green-100 text-green-800' : 
          result.fetch_status === 'blocked' ? 'bg-amber-100 text-amber-800' :
          'bg-red-100 text-red-800'
        }`}>
          {result.fetch_status === 'success' ? 'Success' : 
           result.fetch_status === 'blocked' ? 'Blocked' : 'Failed'}
        </span>
      </div>
      
      <div className="p-6 space-y-6">
        {/* Blocked Alert */}
        {result.fetch_status === 'blocked' && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-900">Access Blocked</h4>
              <p className="text-xs text-amber-800 leading-relaxed">
                The target website used bot protection. Discovery was limited.
              </p>
            </div>
          </div>
        )}

        {/* Small Data Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Main Text</h4>
            <p className="text-gray-900 font-medium leading-relaxed line-clamp-3">
              {result.summary?.topText?.value || 'No text discovered'}
            </p>
          </div>
        {/* Tags Section */}
        {(result.summary?.hashtags?.length > 0 || result.summary?.tags?.length > 0 || result.candidate_tags_from_text?.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hashtags & Platform Tags */}
            {(result.summary?.hashtags?.length > 0 || result.summary?.tags?.length > 0) && (
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Hash className="w-3 h-3" /> Platform & Hash Tags
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(new Set([...(result.summary?.hashtags || []), ...(result.summary?.tags || [])])).map((tag: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-white text-blue-600 rounded-lg text-[10px] font-bold border border-blue-100">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI Extracted Tags */}
            {result.candidate_tags_from_text?.length > 0 && (
              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <AlertCircle className="w-3 h-3" /> AI Keywords
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {result.candidate_tags_from_text.map((tag: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-white text-indigo-600 rounded-lg text-[10px] font-bold border border-indigo-100">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        </div>

        {/* Assets Section */}
        <DiscoveryAssetGrid allAssets={result.summary?.allAssets} />

        {/* Travel Context */}
        <DiscoveryTravelContext data={result.travel_parsed_data} />

        {/* Engine Details */}
        <DiscoveryEngineDetails discovery={result.debug?.discovery} />

        {/* JSON View (Collapsible) */}
        <details className="group border-t border-gray-100 pt-4">
          <summary className="text-sm font-medium text-gray-400 cursor-pointer hover:text-gray-600 transition-colors">
            View Full Technical Trace
          </summary>
          <div className="mt-3">
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-[10px] font-mono overflow-x-auto max-h-[300px]">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </details>
      </div>
    </div>
  );
});

DiscoveryResults.displayName = 'DiscoveryResults';
