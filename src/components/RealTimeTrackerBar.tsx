import React, { useState, useMemo } from 'react';
import { LiveQuote } from '../types';
import { StockLogo } from './StockLogo';
import { getStockTechnicalMetrics } from '../data/technicalData';
import { getMarketSessionInfo, isAssetSessionActive, resolveLiveQuote } from '../utils/marketSession';
import { SHOVEL_SELLERS_COMPANIES } from '../data/shovelSellersData';
import { HYPERSCALER_TICKERS } from '../data/hyperscalersData';
import { TECH_COMPANIES } from '../data/earningsData';
import { FINANCIAL_COMPANIES } from '../data/financialsData';
import { AEROSPACE_DEFENSE_COMPANIES, AEROSPACE_DEFENSE_TICKERS } from '../data/aerospaceDefenseData';
import { SOVEREIGN_BONDS_DATA } from '../data/bondsData';
import { COMMODITIES_DATA } from '../data/commoditiesData';
import { getCurrencySymbol } from '../utils/formatters';
import { 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Play, 
  Pause, 
  AlertTriangle,
  Flame,
  MoveHorizontal,
  Landmark,
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface RealTimeTrackerBarProps {
  quotes: Record<string, LiveQuote>;
  isLoading: boolean;
  isStreaming: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
  onToggleStreaming: () => void;
  onSelectTicker: (ticker: string) => void;
  recentTicks: Record<string, 'up' | 'down'>;
}

// 1. All 34 Shovel Sellers Tickers
const SHOVEL_SELLER_TICKERS = Object.keys(SHOVEL_SELLERS_COMPANIES);

// 2. US Tech Mega-Caps
const US_TECH_TICKERS = [
  'NVDA', 'MSFT', 'AAPL', 'GOOGL', 'AMZN', 'META', 
  'TSM', 'AVGO', 'ORCL', 'AMD', 'CRM', 'NFLX'
];

// 3. European Tech Champions
const HYPERSCALER_TICKERS_LIST = Array.from(HYPERSCALER_TICKERS);

const EU_TECH_TICKERS = [
  'ASML', 'SAP', 'ARM', 'PRX', 'SU', 'SIE', 'SPOT', 'ADYEN', 'IFX', 'STM'
];

// 4. US Financials
const US_FINANCIAL_TICKERS = [
  'JPM', 'BAC', 'C', 'WFC', 'MS', 'GS', 'BX', 'KKR', 'APO', 'ARES'
];

// 5. European Financials
const EU_FINANCIAL_TICKERS = [
  'BCS', 'BARC', 'HSBC', 'ABN', 'ING', 'RABO', 'BNP', 'GLE', 'UBS', 'SAN', 'BBVA', 'SX7P'
];

// 6. Aerospace & Defense\nconst AEROSPACE_DEFENSE_TICKERS_LIST = Array.from(AEROSPACE_DEFENSE_TICKERS);\n\n// 7. Global Energy & Industrial Commodities
const COMMODITY_TICKERS = [
  'TTF', 'NG', 'JKM', 'WTI', 'BRENT', 'MURBAN', 'MRBC', 'OQD', 'INE-SC', 
  'RBOB', 'HO', 'GOLD', 'SILVER', 'COPPER', 'URANIUM', 'LITHIUM', 'WHEAT', 'CORN'
];

// 8. Sovereign Benchmark Government Yields
const GOV_BOND_TICKERS = [
  'US10Y', 'US2Y', 'US30Y', 'US30YFRM', 'DE10Y', 'DE30Y', 
  'JP10Y', 'JP30Y', 'GB10Y', 'GB30Y', 'FR10Y', 'FR30Y', 
  'IT10Y', 'IT30Y', 'ES10Y', 'ES30Y', 'CN10Y', 'CN30Y'
];

// All tickers across the application, deduplicated while preserving logical ordering
const ALL_APPLICATION_TICKERS = Array.from(new Set([
  ...US_TECH_TICKERS,
  ...HYPERSCALER_TICKERS_LIST,
  ...SHOVEL_SELLER_TICKERS,
  ...EU_TECH_TICKERS,
  ...US_FINANCIAL_TICKERS,
  ...EU_FINANCIAL_TICKERS,
  ...COMMODITY_TICKERS,
  ...GOV_BOND_TICKERS
]));

// Comprehensive Quote Resolver across all asset classes
export const getQuoteForTicker = (
  sym: string,
  quotes: Record<string, LiveQuote>
): LiveQuote | null => {
  const live = resolveLiveQuote(sym, quotes);
  if (live) return live;
  const upper = sym.toUpperCase();

  // Sovereign Mortgage & Yield cross-resolution
  if ((upper === 'US30YFRM' || upper === 'US30YMORT') && (quotes['US30YFRM'] || quotes['US30YMORT'])) {
    return quotes['US30YFRM'] || quotes['US30YMORT'];
  }
  // Cross-listed & dual-exchange equities
  if (upper === '2330.TW' && (quotes['2330'] || quotes['TSM'])) return quotes['2330'] || quotes['TSM'];
  if (upper === 'TSM' && (quotes['2330.TW'] || quotes['2330'])) return quotes['2330.TW'] || quotes['2330'];
  if (upper === '8035.T' && (quotes['8035'] || quotes['TOELY'])) return quotes['8035'] || quotes['TOELY'];
  if (upper === 'TOELY' && (quotes['8035.T'] || quotes['8035'])) return quotes['8035.T'] || quotes['8035'];
  if (upper === '6857.T' && (quotes['6857'] || quotes['ATEYY'])) return quotes['6857'] || quotes['ATEYY'];
  if (upper === 'ATEYY' && (quotes['6857.T'] || quotes['6857'])) return quotes['6857.T'] || quotes['6857'];
  if (upper === '0981.HK' && (quotes['0981'] || quotes['SMIC'] || quotes['SMICY'])) return quotes['0981'] || quotes['SMIC'] || quotes['SMICY'];
  if (upper === '0700.HK' && (quotes['0700'] || quotes['TCEHY'])) return quotes['0700'] || quotes['TCEHY'];
  if (upper === '7974.T' && (quotes['7974'] || quotes['NTDOY'])) return quotes['7974'] || quotes['NTDOY'];
  if (upper === '285A.T' && (quotes['285A'] || quotes['KIOXIA'])) return quotes['285A'] || quotes['KIOXIA'];
  if (upper === 'ASML' && quotes['ASML.AS']) return quotes['ASML.AS'];
  if (upper === 'ASML.AS' && quotes['ASML']) return quotes['ASML'];
  if (upper === 'SAP' && quotes['SAP.DE']) return quotes['SAP.DE'];
  if (upper === 'SAP.DE' && quotes['SAP']) return quotes['SAP'];
  if (upper === 'STM' && (quotes['STM.PA'] || quotes['STMPA.PA'])) return quotes['STM.PA'] || quotes['STMPA.PA'];
  if (upper === 'MRBC' && (quotes['MRBC'] || quotes['MURBAN'])) return quotes['MRBC'] || quotes['MURBAN'];
  if (upper === 'MURBAN' && (quotes['MRBC'] || quotes['MURBAN'])) return quotes['MRBC'] || quotes['MURBAN'];
  if (upper === 'OQD' && quotes['OQD']) return quotes['OQD'];

  // 1. Tech Mega-Caps
  const tech = TECH_COMPANIES[sym];
  if (tech) {
    const p = tech.currentPrice;
    const chgPct = tech.dayChangePercent || 0;
    const chg = (p * chgPct) / 100;
    return {
      symbol: sym,
      price: p,
      change: chg,
      changePercent: chgPct,
      dayHigh: tech.fiftyTwoWeekHigh || p * 1.05,
      dayLow: tech.fiftyTwoWeekLow || p * 0.95,
      volume: 12500000,
      previousClose: p - chg,
      currency: ['ASML', 'SAP', 'PRX', 'SU', 'SIE', 'ADYEN', 'IFX', 'STM'].includes(sym) ? 'EUR' : 'USD',
      lastUpdated: new Date().toISOString(),
      isLive: false,
      fiftyTwoWeekHigh: tech.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: tech.fiftyTwoWeekLow,
      twoHundredDayAverage: tech.twoHundredDayAverage
    };
  }

  // 2. Semiconductor & AI Infrastructure Shovel Sellers
  const shovel = (SHOVEL_SELLERS_COMPANIES as any)[sym];
  if (shovel) {
    const p = shovel.currentPrice;
    const chgPct = shovel.dayChangePercent || 0;
    const chg = (p * chgPct) / 100;
    return {
      symbol: sym,
      price: p,
      change: chg,
      changePercent: chgPct,
      dayHigh: shovel.fiftyTwoWeekHigh || p * 1.05,
      dayLow: shovel.fiftyTwoWeekLow || p * 0.95,
      volume: 12500000,
      previousClose: p - chg,
      currency: shovel.currency || shovel.localCurrency || (['ASML', 'SAP', 'PRX', 'SU', 'SIE', 'ADYEN', 'IFX', 'STM'].includes(sym) ? 'EUR' : 'USD'),
      lastUpdated: new Date().toISOString(),
      isLive: false,
      fiftyTwoWeekHigh: shovel.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: shovel.fiftyTwoWeekLow,
      twoHundredDayAverage: shovel.twoHundredDayAverage
    };
  }

  // 3. Financial Institutions (US & European Banks)
  const fin = FINANCIAL_COMPANIES[sym];
  if (fin) {
    const p = fin.currentPrice;
    const chgPct = fin.dayChangePercent || 0;
    const chg = (p * chgPct) / 100;
    const isEur = ['ABN', 'ING', 'BNP', 'GLE', 'SAN', 'BBVA', 'SX7P'].includes(sym);
    const isGbp = ['BCS', 'BARC', 'HSBC'].includes(sym);
    return {
      symbol: sym,
      price: p,
      change: chg,
      changePercent: chgPct,
      dayHigh: p * 1.02,
      dayLow: p * 0.98,
      volume: 8500000,
      previousClose: p - chg,
      currency: fin.currency || (isEur ? 'EUR' : isGbp ? 'GBp' : 'USD'),
      lastUpdated: new Date().toISOString(),
      isLive: false
    };
  }

  // 4. Global Commodities
  const comm = COMMODITIES_DATA.find(c => c.symbol === sym);
  if (comm) {
    return {
      symbol: sym,
      price: comm.currentPrice,
      change: comm.change,
      changePercent: comm.changePercent,
      dayHigh: comm.dayHigh,
      dayLow: comm.dayLow,
      volume: 50000,
      previousClose: comm.currentPrice - comm.change,
      currency: comm.currency || 'USD',
      lastUpdated: new Date().toISOString(),
      isLive: false
    };
  }

  // 5. Sovereign Benchmark Bonds & Yields
  const bond = SOVEREIGN_BONDS_DATA.find(b => b.symbol === sym);
  if (bond) {
    return {
      symbol: sym,
      price: bond.currentYield,
      change: bond.changeBps / 100,
      changePercent: bond.changePercent,
      dayHigh: bond.dayHigh,
      dayLow: bond.dayLow,
      volume: 100000,
      previousClose: bond.previousClose,
      currency: 'USD',
      lastUpdated: new Date().toISOString(),
      isLive: false
    };
  }

  return null;
};

type CategoryFilter = 'ALL' | 'SHOVEL_SELLERS' | 'HYPERSCALERS' | 'US_TECH' | 'US_FIN' | 'EU_FIN' | 'EU_TECH' | 'COMMODITIES' | 'BONDS';

export const RealTimeTrackerBar: React.FC<RealTimeTrackerBarProps> = ({
  quotes,
  isLoading,
  isStreaming,
  lastUpdated,
  onRefresh,
  onToggleStreaming,
  onSelectTicker,
  recentTicks
}) => {
  const [activeCategory, setActiveCategory] = React.useState<CategoryFilter>('ALL');
  const [isGliding, setIsGliding] = useState<boolean>(true);
  const [glideSpeed, setGlideSpeed] = useState<'normal' | 'slow'>('normal');

  const formattedTime = lastUpdated 
    ? lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';

  const rawCategoryTickers = useMemo(() => {
    if (activeCategory === 'SHOVEL_SELLERS') return SHOVEL_SELLER_TICKERS;
    if (activeCategory === 'HYPERSCALERS') return HYPERSCALER_TICKERS_LIST;
    if (activeCategory === 'US_TECH') return US_TECH_TICKERS;
    if (activeCategory === 'EU_TECH') return EU_TECH_TICKERS;
    if (activeCategory === 'US_FIN') return US_FINANCIAL_TICKERS;
    if (activeCategory === 'EU_FIN') return EU_FINANCIAL_TICKERS;
    if (activeCategory === 'COMMODITIES') return COMMODITY_TICKERS;
    if (activeCategory === 'BONDS') return GOV_BOND_TICKERS;

    // USER REQUIREMENT:
    // "daarnaast moeten bij de live ticker bar als ik all heb aanstaan alleen assets weergeven 
    //  waarvan de markt open is of pre/after market is. wel nog behouden op basis van prioriteit"
    const activeAssets = ALL_APPLICATION_TICKERS.filter(sym => {
      const q = getQuoteForTicker(sym, quotes);
      return isAssetSessionActive(sym, q);
    });

    return activeAssets.length > 0 ? activeAssets : ALL_APPLICATION_TICKERS;
  }, [activeCategory, quotes]);

  // Priority Rank Tier: Tech Mega-Caps -> Hyperscalers -> Shovel Sellers -> Commodities -> Sovereign Yields -> Financials
  const getAssetPriorityRank = (sym: string): number => {
    if (US_TECH_TICKERS.includes(sym)) return 1;
    if (HYPERSCALER_TICKERS_LIST.includes(sym)) return 2;
    if (SHOVEL_SELLER_TICKERS.includes(sym)) return 3;
    if (COMMODITY_TICKERS.includes(sym)) return 4;
    if (GOV_BOND_TICKERS.includes(sym)) return 5;
    if (US_FINANCIAL_TICKERS.includes(sym)) return 6;
    if (EU_TECH_TICKERS.includes(sym)) return 7;
    if (EU_FINANCIAL_TICKERS.includes(sym)) return 8;
    return 9;
  };

  // Volatility Sorting with preserved Institutional Tier Priority:
  // "en er voor zorgen dat de aandelen of andere asset classen de volgorde is gebaseerd is op volatiliteit 
  //  dus meeste percentage omhoog of naar beneden als eerst... wel nog behouden op basis van prioriteit"
  const sortedTickers = useMemo(() => {
    return [...rawCategoryTickers].sort((a, b) => {
      const qA = getQuoteForTicker(a, quotes);
      const qB = getQuoteForTicker(b, quotes);
      const volA = Math.abs(qA?.changePercent ?? 0);
      const volB = Math.abs(qB?.changePercent ?? 0);
      // 1. Highest volatility first (meeste percentage omhoog of naar beneden als eerst)
      if (Math.abs(volB - volA) > 0.01) {
        return volB - volA;
      }
      // 2. Preserved priority tier
      const rankA = getAssetPriorityRank(a);
      const rankB = getAssetPriorityRank(b);
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return a.localeCompare(b);
    });
  }, [rawCategoryTickers, quotes]);

  // SPEED CALIBRATION (25% slower than original 85s for 97 items: 0.876s/item -> 1.17s/item)
  // Constant scrolling velocity across all categories:
  const SECONDS_PER_ITEM_NORMAL = 1.17; // 25% slower than original
  const SECONDS_PER_ITEM_SLOW = 1.65;   // Relaxed ticker speed
  const secondsPerItem = glideSpeed === 'slow' ? SECONDS_PER_ITEM_SLOW : SECONDS_PER_ITEM_NORMAL;

  // Ensure base set contains at least 28 items so that it completely spans wide monitors (e.g., 2560px) before looping
  const minBaseItems = 28;
  const repeatsNeeded = Math.max(1, Math.ceil(minBaseItems / Math.max(1, sortedTickers.length)));
  const baseItems = useMemo(() => {
    return Array.from({ length: repeatsNeeded }, () => sortedTickers).flat();
  }, [sortedTickers, repeatsNeeded]);

  // Duration accounts for the lead spacer (equivalent to ~8 ticker widths) plus the baseItems
  const totalUnits = isGliding ? baseItems.length + 8 : baseItems.length;
  const animationDurationSec = Number((totalUnits * secondsPerItem).toFixed(2));

  // Render a single borderless, flowing ticker item
  const renderTickerItem = (sym: string, key: string) => {
    const q: LiveQuote | null = getQuoteForTicker(sym, quotes);
    if (!q) return null;

    const tick = recentTicks[sym];
    const isPositive = q.change >= 0;
    const isFlashingUp = tick === 'up';
    const isFlashingDown = tick === 'down';
    const isCommodity = COMMODITY_TICKERS.includes(sym);
    const isBond = GOV_BOND_TICKERS.includes(sym);
    const isEuropean = ['ASML', 'SAP', 'ARM', 'PRX', 'SU', 'SIE', 'SPOT', 'ADYEN', 'IFX', 'STM', 'ABN', 'ING', 'BNP', 'GLE', 'SAN', 'BBVA'].includes(sym.toUpperCase());
    const curSym = isBond ? '' : (isEuropean && (q.currency === 'EUR' || !q.currency) ? '€' : getCurrencySymbol(q.currency));
    const priceFormatted = isBond ? `${q.price.toFixed(3)}%` : `${curSym}${q.price.toFixed(2)}`;
    
    // Market Session & Pre/After-Market Calculation
    const session = (!isCommodity && !isBond) ? getMarketSessionInfo(sym, q) : null;
    const showPrePost = session && !session.isMarketOpen && (session.sessionLabel === 'Pre-Market' || session.sessionLabel === 'After-Hours') && session.prePostChangePercent !== undefined;

    // Technical check: 200 DMA and 52-week High/Low
    const tech = (!isCommodity && !isBond) ? getStockTechnicalMetrics(sym, q.price, q) : null;
    const isBelow200D = tech?.belowTwoHundredDayAverage;
    const is52WHigh = tech?.is52WeekHigh;
    const is52WLow = tech?.is52WeekLow;

    return (
      <React.Fragment key={key}>
        <button
          id={`ticker-pill-${sym.toLowerCase()}-${key}`}
          onClick={() => onSelectTicker(sym)}
          className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded hover:bg-slate-100/80 transition cursor-pointer text-xs font-mono-code shrink-0 select-none group ${
            isFlashingUp ? 'bg-emerald-50/80' : isFlashingDown ? 'bg-rose-50/80' : ''
          }`}
          title={`${sym} - Click to inspect ${isCommodity ? 'commodity metrics' : isBond ? 'sovereign yield curve' : 'earnings, analyst outlook, and 200 DMA'}`}
        >
          {/* Logo & Symbol */}
          <span className="flex items-center gap-1.5 shrink-0">
            {!isCommodity && !isBond && <StockLogo ticker={sym} size="xs" />}
            {isCommodity && <Flame className="w-3.5 h-3.5 text-amber-600" />}
            {isBond && <Landmark className="w-3.5 h-3.5 text-purple-600" />}
            <span className="font-bold tracking-tight text-slate-900 group-hover:text-blue-700 transition-colors">
              {sym}
            </span>
          </span>

          {/* Price / Yield */}
          <span className="font-semibold tabular-nums text-slate-900">
            {priceFormatted}
          </span>

          {/* Percentage Rate: Clean borderless text with color & arrow */}
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold tabular-nums ${
            isPositive ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{isPositive ? `+${q.changePercent.toFixed(2)}%` : `${q.changePercent.toFixed(2)}%`}</span>
          </span>

          {/* Pre/After-Market change indicator (inline text, no borders) */}
          {showPrePost && (
            <span 
              className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 font-medium"
              title={`${session.sessionLabel}: ${session.prePostChangePercent! >= 0 ? '+' : ''}${session.prePostChangePercent!.toFixed(2)}% (${curSym}${session.prePostPrice?.toFixed(2)})`}
            >
              <span>({session.sessionLabel === 'Pre-Market' ? 'Pre' : 'Post'}:</span>
              <span className={`font-bold tabular-nums ${session.prePostChangePercent! >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {session.prePostChangePercent! >= 0 ? '+' : ''}{session.prePostChangePercent!.toFixed(2)}%
              </span>
              <span>)</span>
            </span>
          )}

          {/* Technical signals (clean text badges) */}
          {isBelow200D && (
            <span 
              title={`Warning: ${sym} is trading below its 200 DMA`}
              className="text-[9.5px] font-bold text-amber-700"
            >
              &lt;200D
            </span>
          )}

          {is52WHigh && (
            <span 
              title={`52-Week High reached`}
              className="text-[9.5px] font-bold text-emerald-700"
            >
              52W-H
            </span>
          )}

          {is52WLow && (
            <span 
              title={`52-Week Low reached`}
              className="text-[9.5px] font-bold text-rose-700"
            >
              52W-L
            </span>
          )}
        </button>

        {/* Continuous Flowing Line Divider */}
        <span className="text-slate-300 select-none text-xs font-light shrink-0 px-0.5">
          |
        </span>
      </React.Fragment>
    );
  };

  return (
    <div 
      id="real-time-tracker-bar"
      className="bg-white border-b border-slate-200 text-slate-800 text-xs shadow-2xs relative z-10"
    >
      {/* LAYER 1: Controls, Live Clock, and Asset Class Categorization */}
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 lg:px-8 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Live Stream Status, Clock, and Control Buttons */}
          <div className="flex items-center space-x-2.5">
            <div className="flex items-center space-x-2 bg-white border border-slate-200 px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-700 shadow-2xs">
              <span className="relative flex h-2 w-2">
                {isStreaming && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isStreaming ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
              </span>
              <span className="font-bold tracking-wider text-slate-800 uppercase font-mono-code text-[10px]">
                {isStreaming ? 'LIVE TICKER FEED' : 'PAUSED'}
              </span>
              <span className="text-slate-300">|</span>
              <span className="font-mono-code tabular-nums text-slate-600 text-[10px] font-semibold">
                {formattedTime} ET
              </span>
            </div>

            <div className="flex items-center space-x-1">
              <button
                id="btn-refresh-quotes"
                onClick={onRefresh}
                disabled={isLoading}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-white border border-transparent hover:border-slate-200 transition cursor-pointer disabled:opacity-50"
                title="Refresh All Quotes Now"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
              </button>

              <button
                id="btn-toggle-streaming"
                onClick={onToggleStreaming}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-white border border-transparent hover:border-slate-200 transition cursor-pointer"
                title={isStreaming ? 'Pause auto-polling (every 8s)' : 'Resume real-time auto-polling'}
              >
                {isStreaming ? (
                  <Pause className="w-3.5 h-3.5 text-slate-600" />
                ) : (
                  <Play className="w-3.5 h-3.5 text-emerald-600" />
                )}
              </button>

              {/* Ticker Tape Glide Movement Control */}
              <button
                id="btn-toggle-glide"
                onClick={() => setIsGliding(!isGliding)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono-code transition cursor-pointer border ${
                  isGliding
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs font-semibold'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
                title={isGliding ? 'Pauzeer doorlopende ticker beweging' : 'Start vloeiende ticker beweging'}
              >
                <MoveHorizontal className={`w-3 h-3 ${isGliding ? 'animate-pulse text-emerald-400' : ''}`} />
                <span>{isGliding ? 'TICKER ACTIEF' : 'TICKER STATISCH'}</span>
              </button>

              {isGliding && (
                <button
                  onClick={() => setGlideSpeed(glideSpeed === 'normal' ? 'slow' : 'normal')}
                  className="px-1.5 py-1 rounded text-[9px] font-mono-code text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer"
                  title="Wissel tickersnelheid"
                >
                  {glideSpeed === 'normal' ? '0.75x SNELHEID' : '0.5x RUSTIG'}
                </button>
              )}

              {/* Volatility Indicator Badge */}
              <div 
                className="hidden xl:flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono-code bg-amber-50 text-amber-900 border border-amber-200/80 shadow-2xs"
                title="Volgorde gebaseerd op volatiliteit: hoogste absolute dagpercentage (winst of verlies) eerst"
              >
                <Flame className="w-3 h-3 text-amber-600 shrink-0" />
                <span className="font-semibold tracking-tight">VOLATILITEIT VOLGORDE (|Δ%|)</span>
              </div>
            </div>
          </div>

          {/* Right: Quick Segment Filter Tabs */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-[10px] font-mono-code overflow-x-auto">
            <button
              onClick={() => setActiveCategory('ALL')}
              className={`px-2.5 py-1 rounded transition cursor-pointer whitespace-nowrap font-medium ${
                activeCategory === 'ALL' ? 'bg-[#002D62] text-white font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ALL ({ALL_APPLICATION_TICKERS.length})
            </button>
            <button
              onClick={() => setActiveCategory('SHOVEL_SELLERS')}
              className={`px-2 py-1 rounded transition cursor-pointer whitespace-nowrap font-medium ${
                activeCategory === 'SHOVEL_SELLERS' ? 'bg-amber-800 text-white font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="All 34 Indispensable Semiconductor & AI Infrastructure Shovel Sellers"
            >
              SHOVEL SELLERS ({SHOVEL_SELLER_TICKERS.length})
            </button>
            <button
              onClick={() => setActiveCategory('HYPERSCALERS')}
              className={`px-2 py-1 rounded transition cursor-pointer whitespace-nowrap font-medium ${
                activeCategory === 'HYPERSCALERS' ? 'bg-violet-700 text-white font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Hyperscalers & Neo Clouds"
            >
              HYPERSCALERS ({HYPERSCALER_TICKERS_LIST.length})
            </button>
            <button
              onClick={() => setActiveCategory('US_TECH')}
              className={`px-2 py-1 rounded transition cursor-pointer whitespace-nowrap font-medium ${
                activeCategory === 'US_TECH' ? 'bg-[#005a9c] text-white font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              US TECH ({US_TECH_TICKERS.length})
            </button>
            <button
              onClick={() => setActiveCategory('US_FIN')}
              className={`px-2 py-1 rounded transition cursor-pointer whitespace-nowrap font-medium ${
                activeCategory === 'US_FIN' ? 'bg-indigo-700 text-white font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              US FIN ({US_FINANCIAL_TICKERS.length})
            </button>
            <button
              onClick={() => setActiveCategory('EU_FIN')}
              className={`px-2 py-1 rounded transition cursor-pointer whitespace-nowrap font-medium ${
                activeCategory === 'EU_FIN' ? 'bg-blue-800 text-white font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              EU FIN ({EU_FINANCIAL_TICKERS.length})
            </button>
            <button
              onClick={() => setActiveCategory('EU_TECH')}
              className={`px-2 py-1 rounded transition cursor-pointer whitespace-nowrap font-medium ${
                activeCategory === 'EU_TECH' ? 'bg-sky-700 text-white font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              EU TECH ({EU_TECH_TICKERS.length})
            </button>
            <button
              onClick={() => setActiveCategory('COMMODITIES')}
              className={`px-2 py-1 rounded transition cursor-pointer whitespace-nowrap font-medium ${
                activeCategory === 'COMMODITIES' ? 'bg-emerald-800 text-white font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              COMMODITIES ({COMMODITY_TICKERS.length})
            </button>
            <button
              onClick={() => setActiveCategory('BONDS')}
              className={`px-2 py-1 rounded transition cursor-pointer whitespace-nowrap font-medium ${
                activeCategory === 'BONDS' ? 'bg-purple-800 text-white font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              BONDS ({GOV_BOND_TICKERS.length})
            </button>
          </div>
        </div>
      </div>

      {/* LAYER 2: REAL-TIME CONTINUOUS MOVING TICKER RIBBON (EXCHANGE MARQUEE) */}
      <div className="px-4 lg:px-8 py-2.5 bg-white overflow-hidden relative group/ticker border-b border-slate-200/80">
        {/* Soft edge fade masks for authentic ticker tape look */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none z-10" />

        <div className="max-w-7xl mx-auto overflow-hidden">
          <div 
            key={`${activeCategory}-${glideSpeed}-${sortedTickers.length}`}
            className={`flex items-center ${
              isGliding 
                ? (glideSpeed === 'slow' ? 'animate-ticker-glide-slow' : 'animate-ticker-glide') 
                : 'overflow-x-auto no-scrollbar scroll-smooth'
            }`}
            style={isGliding ? { animationDuration: `${animationDurationSec}s` } : undefined}
            title={isGliding ? 'Hover om de ticker te pauzeren' : ''}
          >
            {isGliding ? (
              <>
                {/* Block 1: Lead Spacer (ensures first ticker enters from the right) + Base Items */}
                <div className="flex items-center shrink-0">
                  <div className="w-[100vw] max-w-7xl shrink-0 flex items-center justify-end pr-8 text-[11px] font-mono-code font-bold text-slate-400 uppercase tracking-widest select-none">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2.5 animate-pulse" />
                    <span>REAL-TIME EXCHANGE FEED</span>
                  </div>
                  {baseItems.map((sym, idx) => renderTickerItem(sym, `b1-${idx}`))}
                </div>

                {/* Block 2: Identical Lead Spacer + Base Items (for seamless -50% loop) */}
                <div className="flex items-center shrink-0">
                  <div className="w-[100vw] max-w-7xl shrink-0 flex items-center justify-end pr-8 text-[11px] font-mono-code font-bold text-slate-400 uppercase tracking-widest select-none">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2.5 animate-pulse" />
                    <span>REAL-TIME EXCHANGE FEED</span>
                  </div>
                  {baseItems.map((sym, idx) => renderTickerItem(sym, `b2-${idx}`))}
                </div>
              </>
            ) : (
              <div className="flex items-center shrink-0">
                {sortedTickers.map((sym, idx) => renderTickerItem(sym, `static-${idx}`))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
