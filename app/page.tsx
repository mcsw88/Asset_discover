'use client';

import { useState } from 'react';
import { Search, AlertCircle, Loader2, ExternalLink, Play, Image as ImageIcon, Hash, Clipboard, X } from 'lucide-react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to extract data');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Universal Asset Extractor</h1>
          <p className="text-gray-500">
            Extract captions, assets, and travel context from any URL (Instagram, YouTube, Blogs, etc.)
          </p>
        </header>

        <form onSubmit={handleExtract} className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste any URL here..."
              className="block w-full pl-10 pr-20 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow"
              required
            />
            <div className="absolute inset-y-0 right-2 flex items-center gap-1">
              {url && (
                <button
                  type="button"
                  onClick={() => setUrl('')}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Clear URL"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) setUrl(text);
                  } catch (err) {
                    console.error('Failed to read clipboard', err);
                  }
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                title="Paste from clipboard"
              >
                <Clipboard className="w-4 h-4" />
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Discover'}
          </button>
        </form>

        {error && (
          <div className="rounded-xl bg-red-50 p-4 border border-red-200">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden">
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
                    <h4 className="text-sm font-bold text-amber-900">Access Blocked (Bot Protection)</h4>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      The target website is using bot protection (WAF/Cloudflare) or requires a login. 
                      Discovery was halted to prevent extracting data from the block page.
                    </p>
                    <div className="flex gap-4 pt-1">
                      <div className="text-[10px] font-mono text-amber-600">REASON: {result.block_reason}</div>
                      <div className="text-[10px] font-mono text-amber-600">STATUS: {result.http_status}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Scoping Status Badge */}
              {result.multiAsset?.scoping && (
                <div className="flex flex-wrap gap-2">
                  <div className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    result.multiAsset.scoping.extractionStatus === 'fully_scoped' ? 'bg-emerald-100 text-emerald-700' :
                    result.multiAsset.scoping.extractionStatus === 'partially_scoped' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      result.multiAsset.scoping.extractionStatus === 'fully_scoped' ? 'bg-emerald-500' :
                      result.multiAsset.scoping.extractionStatus === 'partially_scoped' ? 'bg-amber-500' :
                      'bg-gray-400'
                    }`} />
                    {result.multiAsset.scoping.extractionStatus?.replace(/_/g, ' ')}
                  </div>
                  {result.multiAsset.targetIdentity && (
                    <div className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      ID: {result.multiAsset.targetIdentity.id}
                    </div>
                  )}
                  <div className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    result.multiAsset.scoping.targetContentStatus === 'target_content_confirmed' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {result.multiAsset.scoping.targetContentStatus?.replace(/_/g, ' ')}
                  </div>
                </div>
              )}

              {/* Multi-Asset Diagnostic Section */}
              {result.summary?.allAssets && result.summary.allAssets.length > 1 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-indigo-500" />
                      Multi-Asset Discovery ({result.summary.allAssets.length})
                    </h4>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      result.debug?.discovery?.multiAsset?.status === 'child_assets_detected' ? 'bg-green-100 text-green-700' :
                      result.debug?.discovery?.multiAsset?.status === 'partial_urls_found' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {result.debug?.discovery?.multiAsset?.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {result.summary.allAssets.map((asset: any, i: number) => (
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
              )}

              {/* Summary Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top Text & Hashtags */}
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Top Text</h4>
                    <p className="text-gray-900 font-medium leading-relaxed">
                      {result.summary?.topText?.value || 'No text discovered'}
                    </p>
                  </div>
                  
                  {result.summary?.hashtags?.length > 0 && (
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                      <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Hash className="w-3 h-3" />
                        Extracted Hashtags
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {result.summary.hashtags.map((tag: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 bg-white text-blue-600 rounded-lg text-xs font-bold border border-blue-100 shadow-sm">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Top Assets */}
                <div className="space-y-4">
                  {result.summary?.topVideo && (
                    <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                      <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Play className="w-3 h-3" />
                        Top Video
                      </h4>
                      <div className="text-xs font-mono text-red-700 truncate mb-2">{result.summary.topVideo.value}</div>
                      <a 
                        href={result.summary.topVideo.value} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-[10px] font-bold text-white bg-red-500 px-3 py-1 rounded-full hover:bg-red-600 transition-colors"
                      >
                        Open Stream <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {result.summary?.topImage && (
                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                      <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <ImageIcon className="w-3 h-3" />
                        Top Image
                      </h4>
                      <div className="relative aspect-video rounded-lg overflow-hidden border border-indigo-200 mb-2">
                        <img 
                          src={result.summary.topImage.value} 
                          alt="Top Discovery" 
                          className="object-cover w-full h-full"
                        />
                      </div>
                      <div className="text-[10px] font-mono text-indigo-700 truncate">{result.summary.topImage.value}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Discovery Engine Details */}
              {result.debug?.discovery && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <Search className="w-4 h-4 text-blue-500" />
                      Discovery Engine Candidates
                    </h4>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-400 font-mono">
                        {result.debug.discovery.debug.timingMs}ms
                      </span>
                      <div className="flex gap-1">
                        {result.debug.discovery.debug.visitedSources.map((s: string) => (
                          <span key={s} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[9px] font-bold uppercase">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {result.debug.discovery.debug.decisions && result.debug.discovery.debug.decisions.length > 0 && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-[10px] text-amber-800 font-mono space-y-1">
                      <div className="font-bold uppercase text-amber-600 mb-1">Engine Decisions:</div>
                      {result.debug.discovery.debug.decisions.map((d: string, i: number) => (
                        <div key={i}>» {d}</div>
                      ))}
                    </div>
                  )}

                  <div className="overflow-x-auto border border-gray-100 rounded-xl">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Kind</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Value / Path / Rules</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wider">Score</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wider">Conf.</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {result.debug.discovery.candidates.slice(0, 20).map((c: any, i: number) => (
                          <tr key={i} className={`hover:bg-gray-50 transition-colors ${c.isBoilerplate ? 'opacity-50 grayscale' : ''}`}>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                c.kind === 'video' ? 'bg-red-100 text-red-700' :
                                c.kind === 'image' ? 'bg-blue-100 text-blue-700' :
                                c.kind === 'text' ? 'bg-amber-100 text-amber-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {c.kind}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-gray-900 truncate max-w-[300px]" title={c.value}>
                                {c.value}
                              </div>
                              <div className="text-[10px] text-gray-400 font-mono truncate max-w-[300px]">
                                {c.source} » {c.path}
                              </div>
                              {c.ruleIds && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {c.ruleIds.map((r: string) => (
                                    <span key={r} className="text-[8px] px-1 bg-gray-50 text-gray-400 rounded border border-gray-100">
                                      {r}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-mono">
                              <div className="text-gray-900 font-bold">{c.score}</div>
                              {c.scoreBreakdown && (
                                <div className="text-[8px] text-gray-400 leading-tight">
                                  {Object.entries(c.scoreBreakdown as Record<string, number>).map(([k, v]) => (
                                  <div key={k}>{k}: {v > 0 ? `+${v}` : v}</div>
                                ))}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${
                                      c.confidence > 0.7 ? 'bg-green-500' :
                                      c.confidence > 0.4 ? 'bg-amber-500' : 'bg-gray-300'
                                    }`}
                                    style={{ width: `${c.confidence * 100}%` }}
                                  />
                                </div>
                                <span className="font-bold text-gray-700">{Math.round(c.confidence * 100)}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {result.debug.discovery.candidates.length > 20 && (
                    <p className="text-[10px] text-gray-400 italic text-center">
                      Showing top 20 of {result.debug.discovery.candidates.length} candidates
                    </p>
                  )}
                </div>
              )}

              {/* Status & Warnings */}
              {(result.errors?.length > 0 || result.warnings?.length > 0) && (
                <div className="space-y-3">
                  {result.errors?.map((err: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                  {result.warnings?.map((warn: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{warn}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Extracted Data */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Raw Caption Candidate</h4>
                    <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700 whitespace-pre-wrap min-h-[60px]">
                      {result.raw_caption_candidate || <span className="text-gray-400 italic">No raw caption extracted</span>}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-blue-600 mb-1 flex items-center gap-2">
                      Cleaned Caption
                      {result.debug?.cleanupApplied && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-normal">
                          Cleanup Applied
                        </span>
                      )}
                    </h4>
                    <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-lg text-sm text-gray-800 whitespace-pre-wrap min-h-[60px]">
                      {result.cleaned_caption_candidate || <span className="text-gray-400 italic">No cleaned caption</span>}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Hashtags ({result.hashtags?.length || 0})</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.hashtags?.length > 0 ? (
                        result.hashtags.map((tag: string, i: number) => (
                          <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-blue-50 text-blue-700 border border-blue-100">
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-400 italic">None</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Candidate Tags (from cleaned text)</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.candidate_tags_from_text?.length > 0 ? (
                        result.candidate_tags_from_text.map((tag: string, i: number) => {
                          return (
                            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {tag}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-sm text-gray-400 italic">None</span>
                      )}
                    </div>
                  </div>

                  {/* Thumbnail & Video Section */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {result.thumbnail_url && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1.5">
                          <ImageIcon className="w-4 h-4" /> Thumbnail
                        </h4>
                        <div className="relative aspect-video rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={result.thumbnail_url} 
                            alt="Thumbnail" 
                            className="object-cover w-full h-full"
                          />
                        </div>
                      </div>
                    )}
                    {result.video_url && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1.5">
                          <Play className="w-4 h-4" /> Video Player
                        </h4>
                        <div className="relative aspect-video rounded-lg overflow-hidden border border-gray-200 bg-black">
                          {result.video_url.includes('youtube.com/embed') || result.video_url.includes('youtube.com/v/') ? (
                            <iframe
                              src={result.video_url}
                              className="w-full h-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          ) : (
                            <video 
                              src={result.video_url} 
                              controls 
                              className="w-full h-full object-contain"
                              poster={result.thumbnail_url || undefined}
                            />
                          )}
                        </div>
                        <div className="mt-2 bg-gray-50 p-2 rounded-lg text-[10px] font-mono text-gray-500 break-all border border-gray-200">
                          <a href={result.video_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                            {result.video_url}
                          </a>
                        </div>
                        {result.raw_video_urls?.length > 0 && (
                          <div className="mt-3 space-y-1.5">
                            <h5 className="text-xs font-bold text-gray-700">Raw Video URLs (CDN/Direct)</h5>
                            <ul className="space-y-1">
                              {result.raw_video_urls.map((url: string, i: number) => (
                                <li key={i} className="bg-gray-50 p-2 rounded-lg text-[10px] font-mono text-gray-500 break-all border border-gray-200">
                                  <a href={url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                                    {url}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Travel Context Analysis Section */}
                  {result.travel_parsed_data && (
                    <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl space-y-4">
                      <h4 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                        Travel Context Analysis
                      </h4>
                      
                      <div className="space-y-3">
                        {/* Helper function to render facet badges */}
                        {(() => {
                          const renderFacet = (title: string, items: any[], colorClass: string) => {
                            if (!items || items.length === 0) return null;
                            return (
                              <div>
                                <div className="text-xs font-semibold text-gray-500 mb-1">{title}</div>
                                <div className="flex flex-wrap gap-1.5">
                                  {items.map((item: any, i: number) => (
                                    <div key={i} className={`inline-flex flex-col px-2 py-1 rounded-md text-xs border ${colorClass}`} title={`Matched: ${item.matches.join(', ')}`}>
                                      <span className="font-bold">{item.label}</span>
                                      <span className="text-[10px] opacity-75 truncate max-w-[120px]">&quot;{item.matches[0]}&quot;</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          };

                          return (
                            <>
                              {renderFacet("Place Identity", result.travel_parsed_data.placeIdentities, "bg-orange-50 text-orange-700 border-orange-200")}
                              {renderFacet("Features", result.travel_parsed_data.features, "bg-teal-50 text-teal-700 border-teal-200")}
                              {renderFacet("Experiences", result.travel_parsed_data.experiences, "bg-pink-50 text-pink-700 border-pink-200")}
                              {renderFacet("Conditions", result.travel_parsed_data.conditions, "bg-indigo-50 text-indigo-700 border-indigo-200")}
                              {renderFacet("Location / Access", result.travel_parsed_data.locationLinks, "bg-cyan-50 text-cyan-700 border-cyan-200")}
                              {renderFacet("Priority Signals", result.travel_parsed_data.priorities, "bg-rose-50 text-rose-700 border-rose-200")}
                              
                              {result.travel_parsed_data.anchors?.length > 0 && (
                                <div>
                                  <div className="text-xs font-semibold text-gray-500 mb-1">Anchors</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {result.travel_parsed_data.anchors.map((anchor: string, i: number) => (
                                      <span key={i} className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                                        {anchor}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                        
                        {/* Fallback if nothing was extracted */}
                        {(!result.travel_parsed_data.placeIdentities?.length && 
                          !result.travel_parsed_data.features?.length && 
                          !result.travel_parsed_data.experiences?.length && 
                          !result.travel_parsed_data.conditions?.length && 
                          !result.travel_parsed_data.locationLinks?.length && 
                          !result.travel_parsed_data.priorities?.length && 
                          !result.travel_parsed_data.anchors?.length) && (
                          <div className="text-sm text-gray-400 italic">No travel context detected.</div>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Meta Data</h4>
                    <dl className="space-y-2 text-sm">
                      <div className="bg-gray-50 p-2 rounded">
                        <dt className="font-medium text-gray-700">Page Title</dt>
                        <dd className="text-gray-600 truncate" title={result.page_title}>{result.page_title || '-'}</dd>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <dt className="font-medium text-gray-700">HTTP Status</dt>
                        <dd className="text-gray-600">{result.http_status || '-'}</dd>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <dt className="font-medium text-gray-700">Final URL</dt>
                        <dd className="text-gray-600 truncate" title={result.final_url}>{result.final_url || '-'}</dd>
                      </div>
                    </dl>
                  </div>

                  {result.debug?.cleanupApplied && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Cleanup Rules Triggered</h4>
                      <div className="bg-gray-50 p-3 rounded-lg text-xs space-y-2">
                        {result.debug.cleanupRulesTriggered?.length > 0 ? (
                          <ul className="list-disc pl-4 text-gray-600 space-y-1">
                            {result.debug.cleanupRulesTriggered.map((rule: string, i: number) => (
                              <li key={i} className="font-mono">{rule}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-gray-400">No rules triggered</span>
                        )}
                        
                        {result.debug.removedSegments?.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <span className="font-medium text-gray-700 block mb-1">Removed Segments:</span>
                            <ul className="list-disc pl-4 text-red-500 space-y-1">
                              {result.debug.removedSegments.map((seg: string, i: number) => (
                                <li key={i} className="truncate" title={seg}>&quot;{seg}&quot;</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Debug Info</h4>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto max-h-[200px]">
                      {JSON.stringify(result.debug, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>

              <details className="group">
                <summary className="text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700">
                  View Full JSON Response
                </summary>
                <div className="mt-3">
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              </details>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
