import { useState, useEffect } from 'react';
import { auth, onAuthStateChanged, User } from '../lib/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Watchdog timeout: force loading to false if Firebase doesn't respond in 5s
    const timeout = setTimeout(() => {
      console.warn('Auth watchdog triggered: forcing loading to false after 5s');
      setLoading(false);
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      clearTimeout(timeout);
      setUser(user);
      setLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  return { user, loading };
}
