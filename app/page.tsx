'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Search, AlertCircle, Loader2, ExternalLink, Play, 
  Image as ImageIcon, Hash, Clipboard, X, History, 
  BarChart3, LogOut, Globe
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { auth, signInWithGoogle, signInWithGoogleRedirect, getGoogleRedirectResult, logout, db } from '@/lib/firebase';
import { 
  collection, doc, getDoc, setDoc, getDocs, 
  query, where, orderBy, limit, serverTimestamp,
  increment, updateDoc
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { DiscoveryResults } from '@/components/DiscoveryResults';
import { HistoryTab, StatsTab } from '@/components/TabContent';

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [showReload, setShowReload] = useState(false);

  // Show reload button if stuck on loading for more than 3 seconds
  useEffect(() => {
    if (authLoading) {
      const timer = setTimeout(() => setShowReload(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [authLoading]);

  const [activeTab, setActiveTab] = useState<'discover' | 'history' | 'stats'>('discover');
  
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError('');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Login failed:', err);
      // Handle "popup blocked" or "cancelled" errors gracefully
      if (err.code === 'auth/popup-blocked') {
        setLoginError('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        setLoginError('로그인창이 닫혔습니다. 다시 시도해주세요.');
      } else {
        setLoginError('로그인 중 오류가 발생했습니다: ' + (err.message || '알 수 없는 오류'));
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRedirectLogin = () => {
    setLoginLoading(true);
    setLoginError('');
    try {
      signInWithGoogleRedirect();
    } catch (err: any) {
      setLoginError('리다이렉트 로그인 시작 중 오류 발생: ' + (err.message || '알 수 없는 오류'));
      setLoginLoading(false);
    }
  };

  // Check for redirect result on mount
  useEffect(() => {
    getGoogleRedirectResult().catch((err) => {
      console.error('Redirect login error', err);
      if (err.code !== 'auth/redirect-cancelled-by-user') {
        setLoginError('로그인 결과 처리 중 오류가 발생했습니다.');
      }
    });
  }, []);

  // Tab 2 & 3 Data
  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Simple key generator for URLs (safe for Unicode and Firestore IDs)
  const getUrlKey = (urlString: string) => {
    try {
      const u = new URL(urlString);
      // Remove protocol and query params for a cleaner key
      const clean = (u.hostname + u.pathname).replace(/\/$/, '');
      // Base64 encode but make it URL/Firestore safe
      return btoa(encodeURIComponent(clean)).replace(/[/+=]/g, '_').slice(0, 50);
    } catch {
      return btoa(encodeURIComponent(urlString)).replace(/[/+=]/g, '_').slice(0, 50);
    }
  };

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !user) return;

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
      setLoading(false); // Stop main loading indicator as soon as we have the result

      // --- Firebase Integration (Run in background to avoid blocking UI) ---
      const urlKey = getUrlKey(url);
      const searchId = `${user.uid}_${urlKey}`;
      
      const searchRef = doc(db, 'searches', searchId);
      getDoc(searchRef).then(async (searchDoc) => {
        if (!searchDoc.exists()) {
          try {
            // 1. Save search record
            await setDoc(searchRef, {
              userId: user.uid,
              userEmail: user.email,
              url: url,
              urlKey: urlKey,
              createdAt: serverTimestamp()
            });

            // 2. Increment global stats
            const statRef = doc(db, 'stats', urlKey);
            const statDoc = await getDoc(statRef);
            
            if (statDoc.exists()) {
              await updateDoc(statRef, {
                count: increment(1)
              });
            } else {
              await setDoc(statRef, {
                url: url,
                urlKey: urlKey,
                count: 1
              });
            }
          } catch (fbErr) {
            console.error('Background Firestore save failed', fbErr);
          }
        }
      });
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    try {
      // Simplified query to avoid index requirements (sorting in memory)
      const q = query(
        collection(db, 'searches'),
        where('userId', '==', user.uid),
        limit(100)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort manually by createdAt desc
      docs.sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setHistory(docs);
    } catch (err) {
      console.error('History fetch error', err);
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  const fetchStats = useCallback(async () => {
    setDataLoading(true);
    try {
      const q = query(collection(db, 'stats'), orderBy('count', 'desc'), limit(50));
      const snap = await getDocs(q);
      setStats(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error('Stats fetch error', err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  const handleAnalyzeAgain = useCallback((url: string) => {
    setUrl(url);
    setActiveTab('discover');
  }, []);

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'stats') fetchStats();
  }, [activeTab, user, fetchHistory, fetchStats]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 space-y-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        {showReload && (
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-500">초기화가 지연되고 있습니다...</p>
            <button 
              onClick={() => window.location.reload()}
              className="text-xs text-blue-600 hover:underline font-bold"
            >
              새로고침 하기
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 space-y-6">
        <div className="text-center space-y-2">
          <Globe className="w-16 h-16 text-blue-600 mx-auto" />
          <h1 className="text-4xl font-black tracking-tight text-gray-900 italic">DISCOVER ALL</h1>
          <p className="text-gray-500 max-w-sm">로그인이 필요한 서비스입니다</p>
        </div>

        {loginError && (
          <div className="max-w-sm w-full bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{loginError}</p>
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loginLoading}
          className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all font-bold text-gray-700 disabled:opacity-50"
        >
          {loginLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          ) : (
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          )}
          {loginLoading ? '로그인 중...' : 'Google 계정으로 시작하기'}
        </button>

        <div className="flex flex-col items-center gap-2">
          <p className="text-[10px] text-gray-400 max-w-xs text-center">
            팝업 차단이 설정된 경우 로그인이 진행되지 않을 수 있습니다.<br/>
            팝업을 허용하신 후 다시 시도해 주세요.
          </p>
          <button 
            onClick={handleRedirectLogin}
            disabled={loginLoading}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            팝업이 뜨지 않나요? 리다이렉트로 로그인하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Globe className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-black tracking-tight text-gray-900 italic uppercase">Discover All</h1>
            </div>
            <p className="text-sm text-gray-500">
              {user.email}님, 환영합니다
            </p>
          </div>
          
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm">
            <button
              onClick={() => setActiveTab('discover')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'discover' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <Search className="w-4 h-4" /> Discover
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'history' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <History className="w-4 h-4" /> History
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'stats' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <BarChart3 className="w-4 h-4" /> Stats
            </button>
            <div className="w-px h-6 bg-gray-200 mx-1" />
            <button
              onClick={logout}
              className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="relative mt-8">
          {/* Discover Tab */}
          <div className={`transition-all duration-300 ${activeTab === 'discover' ? 'opacity-100 visible relative' : 'opacity-0 invisible absolute inset-x-0 top-0 pointer-events-none h-0 overflow-hidden'}`}>
            <motion.div
              initial={false}
              animate={activeTab === 'discover' ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-8 will-change-[transform,opacity]"
            >
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

        <DiscoveryResults result={result} />
      </motion.div>
    </div>

          {/* History Tab */}
          <div className={`transition-all duration-300 ${activeTab === 'history' ? 'opacity-100 visible relative' : 'opacity-0 invisible absolute inset-x-0 top-0 pointer-events-none h-0 overflow-hidden'}`}>
            <HistoryTab 
              history={history} 
              isLoading={dataLoading} 
              onAnalyzeAgain={handleAnalyzeAgain} 
            />
          </div>

          {/* Stats Tab */}
          <div className={`transition-all duration-300 ${activeTab === 'stats' ? 'opacity-100 visible relative' : 'opacity-0 invisible absolute inset-x-0 top-0 pointer-events-none h-0 overflow-hidden'}`}>
            <StatsTab 
              stats={stats} 
              isLoading={dataLoading} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
