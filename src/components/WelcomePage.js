/**
 * WelcomePage - Elegancka strona powitalna z logowaniem
 * Zastępuje modal "Konfiguracja wymagana" dla nieautoryzowanych użytkowników
 */

import React, { useState } from 'react';
import { 
  Mail, Lock, User, Eye, EyeOff, Loader2,
  AlertCircle, CheckCircle, ArrowLeft,
  TrendingUp, BarChart3, Shield, Brain, Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const WelcomePage = () => {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword, isConfigured } = useAuth();
  
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const result = await signInWithEmail(email, password);
        if (!result.success) setError(translateError(result.error));
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
    if (!result.success) setError(translateError(result.error));
    setIsLoading(false);
  };

  // Supabase not configured - show setup instructions
  if (!isConfigured) {
    return (
      <div className="h-screen w-screen flex items-center justify-center p-6"
           style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 50%, #0a0a1a 100%)' }}>
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Konfiguracja Supabase</h1>
          <p className="text-gray-400 mb-6">Ustaw zmienne środowiskowe, aby aktywować system autoryzacji.</p>
          <div className="text-left bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-sm text-gray-300 font-mono space-y-1">
            <p className="text-yellow-400 mb-2"># Utwórz plik .env.local:</p>
            <p>REACT_APP_SUPABASE_URL=https://xxx.supabase.co</p>
            <p>REACT_APP_SUPABASE_ANON_KEY=eyJhbGci...</p>
          </div>
        </div>
      </div>
    );
  }

  const features = [
    { icon: Brain, title: 'AI Analysis', desc: 'Zaawansowana analiza techniczna w czasie rzeczywistym' },
    { icon: TrendingUp, title: 'Trade Signals', desc: 'Automatyczne sygnały SL/TP z walidacją multi-timeframe' },
    { icon: Shield, title: 'Risk Management', desc: 'Kalkulator pozycji i R:R z filtrem wolumenu' },
    { icon: Zap, title: 'Telegram Alerts', desc: 'Natychmiastowe powiadomienia na telefon' },
  ];

  return (
    <div className="h-screen w-screen flex overflow-hidden"
         style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1030 30%, #1a0a2e 60%, #0a0a1a 100%)' }}>
      
      {/* Left side - Branding & Features */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-16 xl:px-24">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, #007AFF 0%, #BF5AF2 100%)' }}>
            <span className="text-white font-bold text-2xl">AI</span>
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white tracking-tight">Trading Terminal</h1>
            <p className="text-gray-400 text-lg">Ultra-Glass Edition</p>
          </div>
        </div>

        <p className="text-xl text-gray-300 mb-12 max-w-lg leading-relaxed">
          Profesjonalna platforma do analizy rynków kryptowalut z AI, sygnałami w czasie rzeczywistym i zintegrowanym dziennikiem transakcji.
        </p>

        <div className="grid grid-cols-2 gap-6 max-w-lg">
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <f.icon className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">{f.title}</h3>
                <p className="text-gray-500 text-xs mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex items-center gap-3 text-gray-500 text-sm">
          <BarChart3 className="w-4 h-4" />
          <span>Binance • Lightweight-Charts • Supabase • React</span>
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="flex-1 lg:max-w-md xl:max-w-lg flex items-center justify-center px-6 lg:px-12">
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4"
                 style={{ background: 'linear-gradient(135deg, #007AFF 0%, #BF5AF2 100%)' }}>
              <span className="text-white font-bold text-2xl">AI</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Trading Terminal</h1>
          </div>

          {/* Form Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white">
              {mode === 'login' && 'Witaj ponownie'}
              {mode === 'register' && 'Utwórz konto'}
              {mode === 'forgot' && 'Reset hasła'}
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {mode === 'login' && 'Zaloguj się, aby uzyskać dostęp do terminala'}
              {mode === 'register' && 'Dołącz do AI Trading Terminal'}
              {mode === 'forgot' && 'Wyślemy link do resetowania hasła'}
            </p>
          </div>

          {/* Error/Success */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-300">{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-xl bg-green-500/15 border border-green-500/30 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-sm text-green-300">{success}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Imię i nazwisko"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white 
                             placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 
                             focus:ring-blue-500/20 transition-all text-sm"
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white 
                           placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 
                           focus:ring-blue-500/20 transition-all text-sm"
              />
            </div>

            {mode !== 'forgot' && (
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Hasło"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-12 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white 
                             placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 
                             focus:ring-blue-500/20 transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            )}

            {mode === 'login' && (
              <div className="text-right">
                <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                  Zapomniałeś hasła?
                </button>
              </div>
            )}

            <button type="submit" disabled={isLoading}
              className="w-full py-3.5 rounded-xl font-medium text-white bg-gradient-to-r from-blue-500 
                         to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 
                         disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm">
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

          {/* Divider + Google */}
          {mode !== 'forgot' && (
            <>
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-gray-500 text-sm">lub</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <button onClick={handleGoogleSignIn} disabled={isLoading}
                className="w-full py-3.5 rounded-xl font-medium text-white bg-white/5 hover:bg-white/10 
                           border border-white/10 disabled:opacity-50 transition-all flex items-center 
                           justify-center gap-3 text-sm">
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
                <button onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
                  className="text-blue-400 hover:text-blue-300 font-medium">Zarejestruj się</button>
              </p>
            )}
            {mode === 'register' && (
              <p className="text-gray-400">
                Masz już konto?{' '}
                <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                  className="text-blue-400 hover:text-blue-300 font-medium">Zaloguj się</button>
              </p>
            )}
            {mode === 'forgot' && (
              <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-2 mx-auto">
                <ArrowLeft className="w-4 h-4" /> Wróć do logowania
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
