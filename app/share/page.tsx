'use client';

import { useEffect, useState } from 'react';

interface SharePayload {
  title: string | null;
  text: string | null;
  url: string | null;
  [key: string]: string | null;
}

export default function SharePage() {
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [rawSearch, setRawSearch] = useState('');
  const [receivedAt, setReceivedAt] = useState('');

  useEffect(() => {
    const search = window.location.search;
    setRawSearch(search);
    setReceivedAt(new Date().toLocaleString('ko-KR'));

    const params = new URLSearchParams(search);
    const data: SharePayload = {
      title: params.get('title'),
      text: params.get('text'),
      url: params.get('url'),
    };

    // 혹시 다른 파라미터도 있으면 전부 수집
    params.forEach((value, key) => {
      if (!['title', 'text', 'url'].includes(key)) {
        data[key] = value;
      }
    });

    setPayload(data);
  }, []);

  const hasAnyValue = payload && Object.values(payload).some(v => v !== null && v !== '');

  return (
    <div style={{ fontFamily: 'monospace', padding: '16px', maxWidth: '100%', overflowX: 'hidden' }}>
      <h1 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
        📦 Share Payload Inspector
      </h1>
      <p style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
        수신 시각: {receivedAt}
      </p>

      {/* Raw Query String */}
      <section style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '6px' }}>
          🔍 Raw Query String
        </h2>
        <div style={{
          background: '#1e1e1e', color: '#d4d4d4', padding: '12px',
          borderRadius: '8px', fontSize: '12px', wordBreak: 'break-all',
          whiteSpace: 'pre-wrap'
        }}>
          {rawSearch || '(없음 - 파라미터가 전달되지 않았습니다)'}
        </div>
      </section>

      {/* Parsed Params */}
      <section style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '6px' }}>
          📋 파싱된 파라미터
        </h2>
        {hasAnyValue ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {payload && Object.entries(payload).map(([key, value]) => (
              <div key={key} style={{
                border: '1px solid #e2e8f0', borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <div style={{
                  background: value ? '#3b82f6' : '#94a3b8',
                  color: 'white', padding: '4px 10px',
                  fontSize: '12px', fontWeight: 'bold'
                }}>
                  {key} {value ? '✅' : '❌ (null)'}
                </div>
                <div style={{
                  padding: '10px', fontSize: '13px',
                  wordBreak: 'break-all', whiteSpace: 'pre-wrap',
                  background: '#f8fafc', color: value ? '#1e293b' : '#94a3b8',
                  minHeight: '36px'
                }}>
                  {value ?? '(값 없음)'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            background: '#fff3cd', border: '1px solid #ffc107',
            borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#856404'
          }}>
            ⚠️ 파라미터가 없습니다.<br />
            Share Target으로 진입하지 않았거나, 인스타그램이 payload를 전달하지 않은 것 같아요.
          </div>
        )}
      </section>

      {/* Full JSON */}
      <section>
        <h2 style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '6px' }}>
          🗂 전체 JSON
        </h2>
        <pre style={{
          background: '#1e1e1e', color: '#4ec9b0', padding: '12px',
          borderRadius: '8px', fontSize: '12px', overflowX: 'auto',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all'
        }}>
          {JSON.stringify(payload, null, 2)}
        </pre>
      </section>

      {/* 홈화면 접근 여부 */}
      <section style={{ marginTop: '20px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '6px' }}>
          📱 PWA 상태
        </h2>
        <PWAStatus />
      </section>
    </div>
  );
}

function PWAStatus() {
  const [isStandalone, setIsStandalone] = useState<boolean | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
  }, []);

  if (isStandalone === null) return null;

  return (
    <div style={{
      background: isStandalone ? '#dcfce7' : '#fef9c3',
      border: `1px solid ${isStandalone ? '#86efac' : '#fde047'}`,
      borderRadius: '8px', padding: '10px', fontSize: '13px',
      color: isStandalone ? '#166534' : '#854d0e'
    }}>
      {isStandalone
        ? '✅ 홈화면(standalone)에서 실행 중 - Share Target 작동 가능'
        : '⚠️ 브라우저에서 실행 중 - Share Target이 작동하지 않을 수 있어요'}
    </div>
  );
}
