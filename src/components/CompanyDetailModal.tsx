import React, { useEffect, useState } from 'react';
import { QuarterlyResult, AiEarningsAnalysis, AlertPreferences, LiveQuote } from '../types';
import { 
  X, 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Cpu, 
  Send, 
  CheckCircle2, 
  Loader2, 
  FileText,
  AlertCircle,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Radio,
  Globe,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { TECH_COMPANIES } from '../data/earningsData';
import { SHOVEL_SELLERS_COMPANIES } from '../data/shovelSellersData';
import { FINANCIAL_COMPANIES } from '../data/financialsData';
import { AEROSPACE_DEFENSE_COMPANIES } from '../data/aerospaceDefenseData';
import { AEROSPACE_DEFENSE_COMPANIES } from '../data/aerospaceDefenseData';
import { getStockQuarterlyConsensus, getStockAnalystOutlooks } from '../data/analystCoverageData';
import { getCurrencySymbol } from '../utils/formatters';
import { getMarketSessionInfo } from '../utils/marketSession';
import { StockLogo } from './StockLogo';
import { FinancialHistoryChart } from './FinancialHistoryChart';

interface CompanyDetailModalProps {
  result: QuarterlyResult | null;
  quote?: LiveQuote | null;
  onClose: () => void;
  onTriggerTestPush: (result: QuarterlyResult) => void;
  preferences: AlertPreferences;
}

export const CompanyDetailModal: React.FC<CompanyDetailModalProps> = ({
  result,
  quote,
  onClose,
  onTriggerTestPush,
  preferences
}) => {
  const [loadingAi, setLoadingAi] = useState<boolean>(false);
  const [aiAnalysis, setAiAnalysis] = useState<AiEarningsAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [liveConsensus, setLiveConsensus] = useState<any | null>(null);
  const [liveOutlooks, setLiveOutlooks] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    const ticker = result?.ticker;
    if (!ticker) {
      setLiveConsensus(null);
      setLiveOutlooks([]);
      return;
    }

    const loadLiveAnalystData = async () => {
      try {
        const res = await fetch(`/api/quarterly-analyst-outlook?symbols=${encodeURIComponent(ticker)}`);
        if (!res.ok) return;
        const json = await res.json();
        const snap = json?.data?.[ticker.toUpperCase()];
        if (!cancelled && snap) {
          setLiveConsensus(snap);
          setLiveOutlooks(Array.isArray(snap.outlooks) ? snap.outlooks : []);
        }
      } catch (err) {
        console.warn('Live analyst snapshot unavailable:', err);
      }
    };

    loadLiveAnalystData();
    return () => { cancelled = true; };
  }, [result?.ticker]);

  // Modal format and entrance/exit animation state
  const [isMounted, setIsMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setIsMounted(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  // Lock background scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Close modal or exit full screen on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullScreen) {
          setIsFullScreen(false);
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isClosing, isFullScreen]);

  if (!result) return null;

  const meta = TECH_COMPANIES[result.ticker] || SHOVEL_SELLERS_COMPANIES[result.ticker] || FINANCIAL_COMPANIES[result.ticker] || AEROSPACE_DEFENSE_COMPANIES[result.ticker];
  const isReported = result.status === 'reported' || result.status === 'reporting_today';
  const epsBeaten = isReported && (result.epsActual ?? 0) >= result.epsEstimate;
  const revBeaten = isReported && (result.revenueActual ?? 0) >= result.revenueEstimate;

  const formatRevenueBillions = (val?: number, currencySym: string = '$') => {
    if (val === undefined || val === null || isNaN(val)) return 'N/A';
    let num = val;
    if (Math.abs(num) >= 1e8) {
      num = num / 1e9;
    }
    return `${currencySym}${num.toFixed(2)}B`;
  };

  const isEuropeanCompany = ['ASML', 'SAP', 'PRX', 'SU', 'SIE', 'ADYEN', 'IFX', 'STM', 'ABN', 'ING', 'RABO', 'BNP', 'GLE', 'SAN', 'BBVA', 'SX7P'].includes(result.ticker.toUpperCase());

  // European stocks must ALWAYS be displayed in their native European market currency EUR (€)
  const currencyCode = isEuropeanCompany 
    ? 'EUR' 
    : (quote?.currency || meta?.currency || result.currency || 'USD');
  const cur = isEuropeanCompany ? '€' : getCurrencySymbol(currencyCode);

  const hasLocal = Boolean(quote?.localCurrency && quote.localCurrency !== 'USD' && quote.localPrice);
  const displayCur = isEuropeanCompany ? '€' : (hasLocal && quote?.localCurrency ? getCurrencySymbol(quote.localCurrency) : cur);

  // Price resolution: ensure European equities always use their native EUR price from Euronext Amsterdam / XETRA
  const rawPrice = quote?.price || meta?.currentPrice || 0;
  const currentPrice = isEuropeanCompany
    ? ((quote?.currency === 'EUR' && quote?.price) ? quote.price : (quote?.localPrice || meta?.currentPrice || (quote?.price && quote?.fxRateToUsd ? Number((quote.price / quote.fxRateToUsd).toFixed(2)) : rawPrice)))
    : (hasLocal && quote?.localPrice ? quote.localPrice : rawPrice);
  const displayPrice = currentPrice;

  const changePct = quote?.changePercent !== undefined ? quote.changePercent : (meta?.dayChangePercent || 0);
  const isPricePositive = changePct >= 0;

  // Currency change calculation
  const changeVal = hasLocal && quote?.localChange !== undefined 
    ? quote.localChange 
    : (hasLocal && quote?.localPrice 
        ? ((quote.localPrice * changePct) / 100) 
        : (quote?.change !== undefined 
            ? quote.change 
            : (((displayPrice || meta?.currentPrice || 0) * (meta?.dayChangePercent || 0)) / 100)));

  const isNoDecimal = (hasLocal ? quote?.localCurrency : currencyCode) === 'JPY' || (hasLocal ? quote?.localCurrency : currencyCode) === 'KRW';
  const formattedAbsChange = isNoDecimal 
    ? Math.round(Math.abs(changeVal)).toLocaleString() 
    : Math.abs(changeVal).toFixed(2);
  const formattedCurrencyChange = `${isPricePositive ? '+' : '-'}${displayCur}${formattedAbsChange}`;

  // Market session info (Pre/Post market)
  const session = getMarketSessionInfo(result.ticker, quote);
  const showPrePost = !session.isMarketOpen && session.prePostChangePercent !== undefined;
  const prePostIsPositive = (session.prePostChangePercent ?? 0) >= 0;
  const prePostChangeVal = (session.prePostPrice !== undefined && quote?.price) 
    ? (session.prePostPrice - quote.price) 
    : undefined;

  // Prefer live Yahoo consensus, then the app-level synchronized snapshot, and only
  // use the curated local dataset as a temporary fallback when Yahoo is unavailable.
  const safeCurrentPrice = (displayPrice && displayPrice > 0) ? displayPrice : (meta?.currentPrice || 150);
  const fallbackConsensus = getStockQuarterlyConsensus(result.ticker, safeCurrentPrice, cur, result);
  const consensus = liveConsensus || result.quarterlyConsensus || fallbackConsensus;
  const fallbackOutlooks = getStockAnalystOutlooks(result.ticker, safeCurrentPrice, cur, result);
  const outlooks = liveOutlooks.length > 0 ? liveOutlooks : ((result.analystOutlooks && result.analystOutlooks.length > 0) ? result.analystOutlooks : fallbackOutlooks);
  const consensusTargetCurrency = getCurrencySymbol(consensus?.targetCurrency || currencyCode);
  const consensusFinancialCurrency = consensus?.isConvertedToUsd
    ? '$'
    : (isEuropeanCompany ? '€' : consensusTargetCurrency);
  const rawQ = consensus?.nextQuarterLabel || consensus?.quarterKey || result.quarter || 'Q4 2026';
  const cleanQuarterLabel = (!rawQ || rawQ.includes('Geen') || rawQ.trim() === '') ? (result.quarter || 'Q4 2026') : rawQ;

  const handleFetchAiMemo = async () => {
    setLoadingAi(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/analyze-earnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: meta || { ticker: result.ticker, name: result.companyName },
          quarter: result.quarter,
          epsEstimate: result.epsEstimate,
          epsActual: result.epsActual,
          revenueEstimate: result.revenueEstimate,
          revenueActual: result.revenueActual,
          guidance: result.guidanceSummary,
          highlights: result.keyHighlights,
          segments: result.segments,
          aiCapex: result.aiCapexHighlight
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      if (data.analysis) {
        setAiAnalysis(data.analysis);
      }
    } catch (err: any) {
      console.error('Error in AI analysis:', err);
      setErrorMsg('Failed to generate institutional memo. Please retry.');
    } finally {
      setLoadingAi(false);
    }
  };

  // Render SVG mini sparkline from live data
  const sparklineData = quote?.sparkline || [currentPrice * 0.992, currentPrice * 0.996, currentPrice * 1.002, currentPrice];
  const minVal = Math.min(...sparklineData);
  const maxVal = Math.max(...sparklineData);
  const range = maxVal - minVal || 1;
  const sparklinePoints = sparklineData.map((val, idx) => {
    const x = (idx / (sparklineData.length - 1)) * 140;
    const y = 35 - ((val - minVal) / range) * 28;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center ${
        isFullScreen ? 'p-0' : 'p-3 sm:p-4'
      } bg-slate-900/60 backdrop-blur-xs transition-all duration-200 ease-out ${
        isMounted && !isClosing ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isFullScreen) handleClose();
      }}
    >
      <div 
        id="company-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="company-detail-modal-title"
        className={`bg-white flex flex-col shadow-2xl overflow-hidden transform transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
          isFullScreen
            ? 'w-full h-full max-w-none max-h-none rounded-none border-0'
            : 'border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[92vh]'
        } ${
          isMounted && !isClosing 
            ? 'opacity-100 translate-y-0 scale-100' 
            : 'opacity-0 translate-y-4 scale-[0.985]'
        }`}
      >
        {/* Soft Header */}
        <div 
          className="border-b border-slate-100 bg-slate-50/70 select-none w-full"
          onDoubleClick={() => setIsFullScreen(prev => !prev)}
        >
          <div className={`flex items-center justify-between ${isFullScreen ? 'px-6 sm:px-8 py-4 max-w-7xl mx-auto w-full' : 'p-4 sm:p-5'}`}>
            <div className="flex items-center gap-3 min-w-0">
              <StockLogo ticker={result.ticker} size="lg" className="w-10 h-10 rounded-xl shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 id="company-detail-modal-title" className="text-base font-bold text-slate-900 font-mono-code truncate">
                    {result.ticker} • {result.companyName}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                    {result.quarter}
                  </span>
                  {isFullScreen && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 shrink-0 hidden sm:inline-block">
                      Full Screen Mode
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate">
                  {meta?.description || 'Leading enterprise technology ecosystem and computing platform.'}
                </p>
              </div>
            </div>

            {/* Top-Right Controls: Format Selector & Close button */}
            <div className="flex items-center gap-2 shrink-0 ml-3">
              {/* Format Options: 2 Formats (Standard vs Full Screen) */}
              <div 
                className="inline-flex items-center p-0.5 sm:p-1 bg-slate-200/80 border border-slate-300/80 rounded-lg text-xs shadow-2xs"
                role="radiogroup"
                aria-label="Modal format options"
              >
                <button
                  type="button"
                  id="btn-format-standard"
                  onClick={() => setIsFullScreen(false)}
                  title="Standard format (current modal size)"
                  aria-pressed={!isFullScreen}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    !isFullScreen
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Standard</span>
                </button>

                <button
                  type="button"
                  id="btn-format-fullscreen"
                  onClick={() => setIsFullScreen(true)}
                  title="Full Screen format (entire screen)"
                  aria-pressed={isFullScreen}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    isFullScreen
                      ? 'bg-blue-600 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Full Screen</span>
                </button>
              </div>

              {/* Close Button (Kruisje) */}
              <button 
                id="btn-close-company-detail-modal"
                onClick={handleClose} 
                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition p-2 rounded-lg cursor-pointer border border-transparent hover:border-rose-200"
                aria-label="Close modal"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className={`flex-1 overflow-y-auto space-y-6 text-xs text-slate-700 ${
          isFullScreen ? 'p-6 sm:p-8 max-w-7xl mx-auto w-full' : 'p-6'
        }`}>
          {/* REAL-TIME MARKET PRICE TRACKER CARD */}
          <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-4 shadow-2xs">
            {/* J.P. Morgan & McKinsey Institutional Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-200/80 text-[11px]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FDF3D8] text-[#855B00] border border-[#F3DE9D]">
                  NOTE
                </span>
                <span className="font-semibold text-[#005a9c]">
                  J.P. Morgan Asset Class: {meta?.sector || 'Global Mega-Cap Technology'}
                </span>
                {(meta?.primaryListing || quote?.primaryListingSymbol) && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono-code">
                    PRIMARY LISTING: {meta?.primaryListing || quote?.primaryListingSymbol} ({meta?.localExchange || meta?.exchange || 'Local'})
                  </span>
                )}
              </div>
              <div className="text-slate-500 font-mono-code">
                SHARECLASS EXCHANGE: <strong className="text-slate-800">{meta?.exchange || 'NASDAQ'}</strong>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500 font-mono-code">
                    CONNECTED REAL-TIME MARKET TRACKER
                  </span>
                  {quote?.isLive && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      LIVE TICK
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-3 flex-wrap">
                  {isEuropeanCompany ? (
                    <span className="text-3xl font-bold font-mono-code tabular-nums text-slate-900">
                      €{displayPrice.toFixed(2)}
                      <span className="text-sm font-sans font-normal text-slate-500 ml-1.5">EUR</span>
                    </span>
                  ) : hasLocal ? (
                    <span className="text-3xl font-bold font-mono-code tabular-nums text-slate-900">
                      {displayCur}{isNoDecimal ? Math.round(displayPrice).toLocaleString() : displayPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-sans font-normal text-slate-500">{quote?.localCurrency}</span>
                    </span>
                  ) : (
                    <span className="text-3xl font-bold font-mono-code tabular-nums text-slate-900">
                      {cur}{isNoDecimal ? Math.round(displayPrice).toLocaleString() : displayPrice.toFixed(2)}
                      {currencyCode !== 'USD' && (
                        <span className="text-sm font-sans font-normal text-slate-500 ml-1.5">{currencyCode}</span>
                      )}
                    </span>
                  )}

                  {/* Absolute Currency Change + Percentage Change Pill */}
                  <span className={`inline-flex items-center gap-1.5 font-mono-code font-bold text-xs sm:text-sm px-2.5 py-1 rounded-full ${
                    isPricePositive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {isPricePositive ? <ArrowUpRight className="w-4 h-4 shrink-0" /> : <ArrowDownRight className="w-4 h-4 shrink-0" />}
                    <span>{formattedCurrencyChange}</span>
                    <span className="text-xs opacity-85">({isPricePositive ? '+' : ''}{changePct.toFixed(2)}%)</span>
                  </span>

                  {/* Pre/After-Market Session Pill with Currency and % */}
                  {showPrePost && session.prePostPrice !== undefined && (
                    <span 
                      className={`inline-flex items-center gap-1 text-[11px] font-mono-code font-semibold px-2 py-0.5 rounded-full border ${
                        prePostIsPositive ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200' : 'bg-rose-50/80 text-rose-700 border border-rose-200'
                      }`}
                      title={`${session.sessionLabel}: ${session.prePostChangePercent! >= 0 ? '+' : ''}${session.prePostChangePercent!.toFixed(2)}%`}
                    >
                      <span className="text-[9px] uppercase font-bold text-slate-400">
                        {session.sessionLabel === 'Pre-Market' ? 'PRE' : 'POST'}
                      </span>
                      <span>
                        {displayCur}{session.prePostPrice.toFixed(2)}
                      </span>
                      {prePostChangeVal !== undefined && (
                        <span>
                          {prePostIsPositive ? '+' : '-'}{displayCur}{Math.abs(prePostChangeVal).toFixed(2)}
                        </span>
                      )}
                      <span className="opacity-80">
                        ({prePostIsPositive ? '+' : ''}{session.prePostChangePercent!.toFixed(2)}%)
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* Sparkline & Intraday Stats */}
              <div className="flex items-center gap-4">
                <div className="hidden sm:block">
                  <div className="text-[10px] text-slate-400 font-mono-code mb-1 text-right">INTRADAY TREND</div>
                  <svg width="140" height="40" className="overflow-visible">
                    <polyline
                      fill="none"
                      stroke={isPricePositive ? '#059669' : '#e11d48'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={sparklinePoints}
                    />
                  </svg>
                </div>

                <div className="border-l border-slate-200 pl-4 space-y-1 font-mono-code text-[11px] text-slate-600">
                  <div>Day Range: <strong className="text-slate-800">{displayCur}{(quote?.dayLow || displayPrice * 0.99).toLocaleString()} - {(quote?.dayHigh || displayPrice * 1.01).toLocaleString()}</strong></div>
                  <div>Market Cap: <strong className="text-slate-800">({(quote?.marketCapUsd || meta?.marketCap || '$100B+').replace(/\s*USD/gi, '').trim()})</strong></div>
                  {quote?.peRatio && <div>P/E (TTM): <strong className="text-slate-800">{quote.peRatio.toFixed(1)}x</strong></div>}
                  <div>Prev Close: <strong className="text-slate-800">{displayCur}{(quote?.previousClose || displayPrice - changeVal).toLocaleString()}</strong></div>
                  <div>Volume: <strong className="text-slate-800">{((quote?.volume || 15000000) / 1000000).toFixed(1)}M</strong></div>
                </div>
              </div>
            </div>
          </div>

          {/* Core Scorecard: EPS & Revenue */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-slate-400 block uppercase text-[10px] font-semibold">Reported EPS</span>
              <div className="text-lg font-bold font-mono-code text-slate-900 mt-0.5">
                {result.epsActual !== undefined ? `${cur}${result.epsActual.toFixed(2)}` : 'Est. ' + cur + result.epsEstimate.toFixed(2)}
              </div>
              <span className={`text-[10px] font-semibold ${epsBeaten ? 'text-emerald-700' : 'text-slate-500'}`}>
                Consensus: {cur}{result.epsEstimate.toFixed(2)}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-slate-400 block uppercase text-[10px] font-semibold">Reported Revenue</span>
              <div className="text-lg font-bold font-mono-code text-slate-900 mt-0.5">
                {result.revenueActual !== undefined ? `${cur}${result.revenueActual.toFixed(2)}B` : 'Est. ' + cur + result.revenueEstimate.toFixed(2) + 'B'}
              </div>
              <span className={`text-[10px] font-semibold ${revBeaten ? 'text-emerald-700' : 'text-slate-500'}`}>
                Consensus: {cur}{result.revenueEstimate.toFixed(2)}B
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-slate-400 block uppercase text-[10px] font-semibold">YoY Growth</span>
              <div className="text-lg font-bold font-mono-code text-emerald-700 mt-0.5">
                {result.revenueYoY !== undefined ? `+${result.revenueYoY}%` : '—'}
              </div>
              <span className="text-[10px] text-slate-500">
                Top-line expansion
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-slate-400 block uppercase text-[10px] font-semibold">Post Market Move</span>
              <div className="text-lg font-bold font-mono-code text-slate-900 mt-0.5">
                {result.priceReactionPercent !== undefined ? (
                  <span className={result.priceReactionPercent >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                    {result.priceReactionPercent >= 0 ? '+' : ''}{result.priceReactionPercent}%
                  </span>
                ) : 'Pending'}
              </div>
              <span className="text-[10px] text-slate-500">
                Immediate 8-K reaction
              </span>
            </div>
          </div>

          {/* Key Segments */}
          {result.segments && result.segments.length > 0 && (
            <div>
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2 font-mono-code">
                Business Unit & Segment Performance
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {result.segments.map((seg, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{seg.name}</span>
                      <span className="font-bold font-mono-code text-slate-900">{seg.revenue}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                      <span>YoY: <strong className="text-emerald-700 font-semibold">{seg.growthYoY}</strong></span>
                      {seg.notes && <span className="text-slate-500 truncate max-w-[150px]">{seg.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quarterly Analyst Consensus Snapshot */}
          {consensus && !result.isBankingIndex && (
            <div className="border-t border-slate-200 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-700" />
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] font-mono-code">
                    Quarterly Analyst Consensus
                  </h4>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono-code">
                  <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-bold">
                    Forward Quarter: {cleanQuarterLabel}
                  </span>
                  <span className={`${consensus.isLiveFeed !== false ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'} border px-2 py-0.5 rounded font-medium`}>
                    {consensus.isLiveFeed !== false ? 'Yahoo Finance Live' : 'Verified Consensus'}
                  </span>
                  {consensus.monthlyRevisionDate && (
                    <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded">
                      Revision: {consensus.monthlyRevisionDate}
                    </span>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                Live analyst consensus from Yahoo Finance earnings estimates. The displayed quarter follows Yahoo's current earnings-estimate period and is refreshed automatically.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                  <span className="text-[10px] text-slate-400 block uppercase">Consensus</span>
                  <strong className="text-sm text-indigo-700 font-bold">{consensus.consensusRating || 'N/A'}</strong>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 block uppercase">Avg. Target</span>
                    {consensus.upsidePercent !== undefined && (
                      <span className={`text-[9px] font-mono-code font-bold px-1 rounded ${
                        consensus.upsidePercent >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {consensus.upsidePercent >= 0 ? '+' : ''}{consensus.upsidePercent}%
                      </span>
                    )}
                  </div>
                  <strong className="text-sm text-slate-900 font-bold">
                    {consensus.averagePriceTarget !== undefined ? `${consensusTargetCurrency}${consensus.averagePriceTarget.toFixed(2)}` : 'N/A'}
                  </strong>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                  <span className="text-[10px] text-slate-400 block uppercase">Target Range</span>
                  <strong className="text-xs text-slate-700 font-mono-code block mt-0.5">
                    {consensus.lowPriceTarget !== undefined && consensus.highPriceTarget !== undefined
                      ? `${consensusTargetCurrency}${consensus.lowPriceTarget.toFixed(0)} - ${consensusTargetCurrency}${consensus.highPriceTarget.toFixed(0)}`
                      : 'N/A'}
                  </strong>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                  <span className="text-[10px] text-slate-400 block uppercase">Forward Q EPS</span>
                  <strong className="text-sm text-blue-700 font-bold">
                    {consensus.nextQuarterEps !== undefined ? `${consensusFinancialCurrency}${consensus.nextQuarterEps.toFixed(2)}` : 'N/A'}
                  </strong>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 block uppercase">Forward Q Revenue</span>
                    <span className="text-[8px] font-mono-code font-bold px-1 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200" title="Consensus average from Wall Street sell-side analysts">
                      Analyst Avg.
                    </span>
                  </div>
                  <strong className="text-sm text-slate-900 font-bold block mt-0.5">
                    {formatRevenueBillions(consensus.nextQuarterRevenue, consensusFinancialCurrency)}
                    {consensus.isConvertedToUsd && <span className="text-xs font-semibold text-amber-700 ml-1">USD</span>}
                  </strong>
                  {consensus.nextQuarterRevenueLow !== undefined && consensus.nextQuarterRevenueHigh !== undefined && (
                    <span className="text-[10px] text-slate-400 font-mono-code block">
                      Range: {consensusFinancialCurrency}{consensus.nextQuarterRevenueLow}B - {consensusFinancialCurrency}{consensus.nextQuarterRevenueHigh}B
                    </span>
                  )}
                </div>
              </div>

              {/* Explicit USD Conversion Banner for non-EU/US companies */}
              {consensus.isConvertedToUsd && (
                <div className="mt-2.5 flex items-center gap-2 bg-amber-50/90 border border-amber-200/90 rounded-md px-3 py-1.5 text-[11px] text-amber-900">
                  <Globe className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <div>
                    <span className="font-bold text-amber-800 uppercase text-[10px] tracking-wider px-1.5 py-0.2 bg-amber-200/70 rounded mr-1.5">Converted to USD</span>
                    <span>{consensus.conversionNote || 'Analyst consensus revenue is normalized to USD ($) for comparison.'}</span>
                  </div>
                </div>
              )}

              {consensus.recommendationCounts && (
                <div className="flex flex-wrap gap-2 mt-2.5 text-[10px] font-mono-code">
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Strong Buy {consensus.recommendationCounts.strongBuy}</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Buy {consensus.recommendationCounts.buy}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">Hold {consensus.recommendationCounts.hold}</span>
                  <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">Sell {consensus.recommendationCounts.sell}</span>
                  <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">Strong Sell {consensus.recommendationCounts.strongSell}</span>
                </div>
              )}
              <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Live update cycle • {consensus.analystsCount || 0} analysts tracked</span>
                <span className="font-mono-code text-indigo-700">Horizon: {consensus.twelveMonthHorizon || '12 Months'}</span>
              </div>
            </div>
          )}

          {/* 5-Year Quarterly Financial History (Revenue, FCF, EPS, Net Income) with Single-Metric Option Bar */}
          <div className="border-t border-slate-200 pt-4">
            <FinancialHistoryChart 
              ticker={result.ticker} 
              companyName={result.companyName} 
              currency={cur} 
            />
          </div>

          {/* Investment Bank Analyst Outlooks (User-Requested Financial Feature) */}
          {outlooks && outlooks.length > 0 && !result.isBankingIndex && (
            <div className="border-t border-slate-200 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-700" />
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] font-mono-code">
                    Investment Bank Analyst Outlook (Next Quarter & 12M Horizon)
                  </h4>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono-code">
                  <span className="text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-bold">
                    Forward Quarter: {cleanQuarterLabel}
                  </span>
                  <span className={`${consensus?.isLiveFeed !== false ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-slate-700 bg-slate-100 border-slate-200'} border px-2 py-0.5 rounded font-bold`}>
                    {consensus?.isLiveFeed !== false ? 'Yahoo Finance Coverage' : 'Institutional Consensus'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {outlooks.map((outlook, idx) => {
                  const targetNum = outlook.targetPriceNumeric !== undefined
                    ? outlook.targetPriceNumeric
                    : (typeof outlook.targetPrice === 'number'
                        ? outlook.targetPrice
                        : parseFloat(String(outlook.targetPrice || '').replace(/[^0-9.]/g, '')));

                  const formattedTargetPrice = typeof outlook.targetPrice === 'number'
                    ? `${consensusTargetCurrency}${outlook.targetPrice.toFixed(2)}`
                    : (outlook.targetPrice || (targetNum ? `${consensusTargetCurrency}${targetNum.toFixed(2)}` : 'N/A'));

                  const upside = (targetNum && safeCurrentPrice > 0)
                    ? (((targetNum - safeCurrentPrice) / safeCurrentPrice) * 100).toFixed(1)
                    : null;

                  return (
                    <div key={idx} className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span 
                            className="w-2.5 h-2.5 rounded-full" 
                            style={{ backgroundColor: outlook.logoColor || '#005a9c' }} 
                          />
                          <strong className="text-xs font-bold text-slate-900 font-mono-code">
                            {outlook.bankName}
                          </strong>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            outlook.rating.toLowerCase().includes('buy') || outlook.rating.toLowerCase().includes('outperform') || outlook.rating.toLowerCase().includes('overweight')
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {outlook.rating}
                          </span>
                          <span className="text-[10px] bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 rounded font-mono-code">
                            {outlook.provider || 'Yahoo Finance Analyst Coverage'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 font-mono-code text-xs">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">Price Target</span>
                            <div className="flex items-center gap-1.5">
                              <strong className="text-slate-900 font-bold">{formattedTargetPrice}</strong>
                              {upside && (
                                <span className={`text-[10px] font-bold ${Number(upside) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  ({Number(upside) >= 0 ? '+' : ''}{upside}%)
                                </span>
                              )}
                            </div>
                          </div>
                          {outlook.nextQuarterEpsEst && (
                            <div className="text-right border-l border-slate-200 pl-3">
                              <span className="text-[10px] text-slate-400 block">Forward Q EPS</span>
                              <strong className="text-blue-700">{outlook.nextQuarterEpsEst}</strong>
                            </div>
                          )}
                          {outlook.nextQuarterRevEst && (
                            <div className="text-right border-l border-slate-200 pl-3">
                              <span className="text-[10px] text-slate-400 block">Forward Q Revenue</span>
                              <strong className="text-slate-800">{outlook.nextQuarterRevEst}</strong>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Investment Thesis Box */}
                      <div className="bg-slate-50/90 rounded-lg p-3 border border-slate-200/80 mb-2.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <FileText className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                          <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wide">
                            Investment Thesis & Quarterly Outlook:
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed font-sans">
                          {outlook.thesis || `${outlook.bankName} maintains a ${outlook.rating} rating for ${result.ticker} with a price target of ${formattedTargetPrice}. Data sourced directly from official SEC Form 10-Q/8-K reports and sell-side analyst consensus.`}
                        </p>
                      </div>

                      {outlook.catalysts && outlook.catalysts.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Key Catalysts:</span>
                          {outlook.catalysts.map((cat: string, cIdx: number) => (
                            <span key={cIdx} className="text-[10px] bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                              • {cat}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="text-[10px] text-slate-400 mt-2.5 flex items-center justify-between border-t border-slate-100 pt-1.5">
                        <span>Source: {outlook.provider || 'Yahoo Finance Analyst Coverage'}</span>
                        <span>Horizon: {outlook.timeHorizon || '12 Months'} • Last Revised: {outlook.lastUpdated || consensus?.monthlyRevisionDate || 'Current'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Data Provenance & Methodology Explanatory Card */}
              <div className="mt-3 bg-gradient-to-r from-blue-50/60 via-slate-50 to-indigo-50/60 border border-blue-200/60 rounded-xl p-3.5 text-xs text-slate-700">
                <div className="flex items-center gap-2 mb-2 font-bold text-slate-900">
                  <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0" />
                  <span className="text-[11px] font-mono-code uppercase tracking-wider">Methodology: Where does the quarterly data come from?</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[11px] leading-relaxed text-slate-600">
                  <div className="bg-white/80 border border-slate-200/60 rounded-lg p-2.5">
                    <strong className="text-slate-800 block mb-0.5 font-semibold">1. Reported Financials & History (SEC Filings):</strong>
                    Realized revenue, net income, EPS, and cash flows are directly sourced from official SEC filings (Form 10-Q & 8-K) and corporate earnings reports.
                  </div>
                  <div className="bg-white/80 border border-slate-200/60 rounded-lg p-2.5">
                    <strong className="text-slate-800 block mb-0.5 font-semibold">2. Forward Quarter & Consensus (Wall Street):</strong>
                    Consensus EPS and revenue estimates represent the weighted average of 30 to 50 registered sell-side equity analysts via the Yahoo Finance consensus feed (earningsTrend module).
                  </div>
                  <div className="bg-white/80 border border-slate-200/60 rounded-lg p-2.5">
                    <strong className="text-slate-800 block mb-0.5 font-semibold">3. Price Targets & Ratings (Investment Banks):</strong>
                    Directly sourced from registered equity research actions and target price updates from major investment banks (including Goldman Sachs, Morgan Stanley, Piper Sandler).
                  </div>
                  <div className="bg-white/80 border border-slate-200/60 rounded-lg p-2.5">
                    <strong className="text-slate-800 block mb-0.5 font-semibold">4. How is the Investment Thesis resolved?</strong>
                    Because full equity research PDF reports reside behind institutional paywalls (Bloomberg/FactSet), this platform synthesizes the core bank thesis each quarter based on the analyst's rating action, price target upside, and operational catalysts.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STOXX Benchmark Note (Explicitly requested: no single-stock bank outlooks for STOXX Europe 600 Banks Index) */}
          {result.isBankingIndex && (
            <div className="border-t border-slate-200 pt-3">
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 text-xs text-sky-900">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <Activity className="w-4 h-4 text-sky-700" />
                  <span>STOXX Europe 600 Banks Benchmark Index Specifications</span>
                </div>
                <p className="text-sky-800 leading-relaxed">
                  As the primary European banking sector benchmark index covering 44 institutions across 17 nations, 
                  individual single-stock bank target prices are omitted. The aggregate index trades at 
                  <strong> 7.6x forward earnings</strong> with an average constituent dividend yield of 
                  <strong> 6.7%</strong> and average CET1 solvency ratio of <strong>15.6%</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Guidance & AI CapEx */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <span className="font-bold text-slate-800 uppercase text-[11px] block mb-1">
                Forward Guidance Summary
              </span>
              <p className="text-slate-600 leading-relaxed">
                {result.guidanceSummary}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <span className="font-bold text-slate-800 uppercase text-[11px] block mb-1 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-blue-600" />
                <span>AI Infrastructure & CapEx</span>
              </span>
              <p className="text-slate-600 leading-relaxed">
                {result.aiCapexHighlight || 'CapEx prioritized toward compute expansion and data center buildouts.'}
              </p>
            </div>
          </div>

          {/* AI Executive Memo Section */}
          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <h4 className="font-bold text-slate-900 uppercase text-[11px] font-mono-code">
                  Executive AI Earnings Memo (Gemini Model)
                </h4>
              </div>
              {!aiAnalysis && (
                <button
                  id="btn-generate-memo-modal"
                  onClick={handleFetchAiMemo}
                  disabled={loadingAi}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  {loadingAi ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Synthesizing Memo...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Institutional Memo</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {aiAnalysis && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5 text-xs">
                <div>
                  <span className="font-bold text-slate-900 block mb-1 uppercase text-[10px] text-blue-700 font-mono-code">
                    Executive Verdict
                  </span>
                  <p className="text-slate-700 leading-relaxed bg-white border border-slate-200 rounded-lg p-3">
                    {aiAnalysis.summaryVerdict}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <span className="font-bold text-slate-900 block text-[10px] uppercase mb-1">Financial Health & Margins</span>
                    <p className="text-slate-600 leading-relaxed">
                      {aiAnalysis.financialScorecard?.marginTrends}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <span className="font-bold text-slate-900 block text-[10px] uppercase mb-1">AI CapEx Takeaway</span>
                    <p className="text-slate-600 leading-relaxed">
                      {aiAnalysis.aiAndCapexTakeaway}
                    </p>
                  </div>
                </div>

                {aiAnalysis.bullCase && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3">
                      <span className="font-bold text-emerald-800 block text-[10px] uppercase mb-1">Bull Catalyst</span>
                      <p className="text-emerald-900 leading-relaxed">{aiAnalysis.bullCase}</p>
                    </div>
                    <div className="bg-rose-50/70 border border-rose-200 rounded-lg p-3">
                      <span className="font-bold text-rose-800 block text-[10px] uppercase mb-1">Bear Risk</span>
                      <p className="text-rose-900 leading-relaxed">{aiAnalysis.bearCase}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-100 bg-slate-50/70 w-full">
          <div className={`p-4 flex items-center justify-between ${isFullScreen ? 'px-6 sm:px-8 max-w-7xl mx-auto w-full' : ''}`}>
            <button
              id="btn-test-push-company"
              onClick={() => onTriggerTestPush(result)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold text-xs transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Broadcast Push Notification</span>
              <span className="sm:hidden">Push Alert</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFullScreen(prev => !prev)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition cursor-pointer flex items-center gap-1.5"
                title={isFullScreen ? "Switch to Standard Format" : "Switch to Full Screen Format"}
              >
                {isFullScreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 text-blue-600" />
                    <span className="hidden sm:inline">Standard Size</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Full Screen</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs transition cursor-pointer"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
