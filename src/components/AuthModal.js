/**
 * AuthModal - Modernistyczny modal logowania w stylu macOS
 * Obsługuje: Email/Password + Google OAuth
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AuthModal = ({ isOpen, onClose }) => {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword, isConfigured } = useAuth();
  
  const [mode, setMode] = useState('login'); // login | register | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Reset form przy zmianie trybu
  useEffect(() => {
    setError('');
    setSuccess('');
  }, [mode]);

  // Zamknij modal klawiszem ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Sprawdź czy Supabase jest skonfigurowany
  if (!isConfigured) {
    return (
      <ModalWrapper onClose={onClose}>
        <div className="text-center py-8">
          <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Konfiguracja wymagana</h2>
          <p className="text-gray-400 text-sm mb-4">
            System autoryzacji wymaga konfiguracji Supabase.
          </p>
          <div className="text-left bg-black/30 rounded-lg p-4 text-xs text-gray-300 font-mono">
            <p className="text-yellow-400 mb-2"># Utwórz plik .env.local:</p>
            <p>REACT_APP_SUPABASE_URL=https://xxx.supabase.co</p>
            <p>REACT_APP_SUPABASE_ANON_KEY=eyJhbGci...</p>
          </div>
          <button
            onClick={onClose}
            className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
          >
            Zamknij
          </button>
        </div>
      </ModalWrapper>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const result = await signInWithEmail(email, password);
        if (result.success) {
          onClose();
        } else {
          setError(translateError(result.error));
        }
      } else if (mode === 'register') {
        if (password.length < 6) {
          setError('Hasło musi mieć minimum 6 znaków');
          setIsLoading(false);
          return;
        }
        const result = await signUpWithEmail(email, password, fullName);
        if (result.success) {
          setSuccess('Sprawdź email, aby potwierdzić rejestrację');
          setMode('login');
        } else {
          setError(translateError(result.error));
        }
      } else if (mode === 'forgot') {
        const result = await resetPassword(email);
        if (result.success) {
          setSuccess('Link do resetowania hasła został wysłany na email');
        } else {
          setError(translateError(result.error));
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const result = await signInWithGoogle();
    if (!result.success) {
      setError(translateError(result.error));
    }
    setIsLoading(false);
  };

  const translateError = (error) => {
    const translations = {
      'Invalid login credentials': 'Nieprawidłowy email lub hasło',
      'Email not confirmed': 'Email nie został potwierdzony',
      'User already registered': 'Użytkownik już istnieje',
      'Password should be at least 6 characters': 'Hasło musi mieć minimum 6 znaków',
      'Unable to validate email address: invalid format': 'Nieprawidłowy format email'
    };
    return translations[error] || error;
  };

  return (
    <ModalWrapper onClose={onClose}>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          {mode === 'forgot' ? (
            <Mail className="w-8 h-8 text-white" />
          ) : (
            <User className="w-8 h-8 text-white" />
          )}
        </div>
        <h2 className="text-2xl font-bold text-white">
          {mode === 'login' && 'Witaj ponownie'}
          {mode === 'register' && 'Utwórz konto'}
          {mode === 'forgot' && 'Reset hasła'}
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          {mode === 'login' && 'Zaloguj się, aby uzyskać dostęp do AI Analyzera'}
          {mode === 'register' && 'Dołącz do AI Trading Terminal'}
          {mode === 'forgot' && 'Wyślemy link do resetowania hasła'}
        </p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-300">{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
          <span className="text-sm text-green-300">{success}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name (tylko rejestracja) */}
        {mode === 'register' && (
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Imię i nazwisko"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
        )}

        {/* Email */}
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>

        {/* Password (nie dla forgot) */}
        {mode !== 'forgot' && (
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Hasło"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full pl-11 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        )}

        {/* Forgot Password Link (tylko login) */}
        {mode === 'login' && (
          <div className="text-right">
            <button
              type="button"
              onClick={() => setMode('forgot')}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Zapomniałeś hasła?
            </button>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-xl font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              {mode === 'login' && 'Zaloguj się'}
              {mode === 'register' && 'Zarejestruj się'}
              {mode === 'forgot' && 'Wyślij link'}
            </>
          )}
        </button>
      </form>

      {/* Divider */}
      {mode !== 'forgot' && (
        <>
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-gray-500 text-sm">lub</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full py-3 rounded-xl font-medium text-white bg-white/10 hover:bg-white/20 border border-white/10 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Kontynuuj z Google
          </button>
        </>
      )}

      {/* Mode Switch */}
      <div className="mt-6 text-center text-sm">
        {mode === 'login' && (
          <p className="text-gray-400">
            Nie masz konta?{' '}
            <button
              onClick={() => setMode('register')}
              className="text-blue-400 hover:text-blue-300 font-medium"
            >
              Zarejestruj się
            </button>
          </p>
        )}
        {mode === 'register' && (
          <p className="text-gray-400">
            Masz już konto?{' '}
            <button
              onClick={() => setMode('login')}
              className="text-blue-400 hover:text-blue-300 font-medium"
            >
              Zaloguj się
            </button>
          </p>
        )}
        {mode === 'forgot' && (
          <button
            onClick={() => setMode('login')}
            className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-2 mx-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Wróć do logowania
          </button>
        )}
      </div>
    </ModalWrapper>
  );
};

// Modal Wrapper Component
const ModalWrapper = ({ children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    {/* Backdrop */}
    <div 
      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    />
    
    {/* Modal */}
    <div 
      className="relative w-full max-w-md p-8 rounded-3xl"
      style={{
        background: 'rgba(30, 30, 30, 0.85)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
      >
        <X className="w-5 h-5 text-gray-400" />
      </button>

      {children}
    </div>
  </div>
);

export default AuthModal;
