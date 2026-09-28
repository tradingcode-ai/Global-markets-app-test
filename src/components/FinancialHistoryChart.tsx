import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  ReferenceLine 
} from 'recharts';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  RefreshCw, 
  Calendar, 
  CheckCircle2, 
  Layers, 
  Table as TableIcon,
  ChevronDown,
  ChevronUp,
  Info,
  MousePointerClick,
  FileText
} from 'lucide-react';
import { CompanyFinancialHistory, QuarterlyFinancialPoint, FinancialMetricKey } from '../types';
import { getCurrencySymbol } from '../utils/formatters';
import {
  getOfficialFiscalQuarterLabel,
  getOfficialReportedReleaseDate,
  formatQuarterReleaseLabel,
  formatDutchDate,
  formatDutchShortDate
} from '../utils/fiscalUtils';

interface FinancialHistoryChartProps {
  ticker: string;
  companyName?: string;
  currency?: string;
}

export const FinancialHistoryChart: React.FC<FinancialHistoryChartProps> = ({
  ticker,
  companyName,
  currency = '$'
}) => {
  // Active metric toggle - only ONE displayed at a time as strictly requested
  const [activeMetric, setActiveMetric] = useState<FinancialMetricKey>('revenue');
  // Time span range
  const [timeRange, setTimeRange] = useState<'5Y' | '3Y' | '1Y'>('5Y');
  // Chart visual style
  const [chartType, setChartType] = useState<'bar' | 'area'>('bar');
  // Data state
  const [data, setData] = useState<CompanyFinancialHistory | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [showTable, setShowTable] = useState<boolean>(false);
  // Interactive selected quarter clicked by the user
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterlyFinancialPoint | null>(null);

  const FINANCIAL_SNAPSHOT_KEY = `global-markets-financial-snapshot:${ticker.toUpperCase()}`;

  // Fetch financial history
  const fetchFinancials = async (force: boolean = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);

    try {
      const url = `/api/financials-history/${encodeURIComponent(ticker)}${force ? '?forceRefresh=true' : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const json: CompanyFinancialHistory = await res.json();
        setData(json);
        try {
          window.localStorage.setItem(FINANCIAL_SNAPSHOT_KEY, JSON.stringify({
            ...json,
            snapshotSavedAt: new Date().toISOString(),
            isCachedSnapshot: false
          }));
        } catch {
          // Ignore unavailable/full browser storage.
        }
      } else {
        try {
          const raw = window.localStorage.getItem(FINANCIAL_SNAPSHOT_KEY);
          if (raw) {
            const cached = JSON.parse(raw) as CompanyFinancialHistory;
            if (cached?.quarters?.length) {
              setData({
                ...cached,
                isLive: false,
                provider: 'Yahoo Finance — Cached Snapshot'
              } as CompanyFinancialHistory);
            }
          }
        } catch {
          // No usable local snapshot.
        }
      }
    } catch (err) {
      console.warn('Failed to load financial history:', err);
      try {
        const raw = window.localStorage.getItem(FINANCIAL_SNAPSHOT_KEY);
        if (raw) {
          const cached = JSON.parse(raw) as CompanyFinancialHistory;
          if (cached?.quarters?.length) {
            setData({
              ...cached,
              isLive: false,
              provider: 'Yahoo Finance — Cached Snapshot'
            });
          }
        }
      } catch {
        // No usable local snapshot.
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (ticker) {
      setSelectedQuarter(null);
      fetchFinancials(false);
    }
  }, [ticker]);

  // Robust deduplication and time range slicing:
  // Ensures strictly ONE bar per quarter on the X-axis with standard calendar dates (e.g. jul'2026),
  // while attaching the company's official fiscal quarter label and exact earnings disclosure date.
  const filteredQuarters = useMemo(() => {
    if (!data || !data.quarters) return [];

    const deduped: QuarterlyFinancialPoint[] = [];
    for (const rawQ of data.quarters) {
      const displayLabel = rawQ.displayLabel || formatQuarterReleaseLabel(rawQ.fiscalDate, rawQ.releaseLabel || rawQ.quarter);
      const fiscalQuarterLabel = rawQ.fiscalQuarterLabel || getOfficialFiscalQuarterLabel(
        ticker,
        rawQ.fiscalDate,
        rawQ.quarter,
        rawQ.fiscalYear,
        rawQ.quarterNum
      );
      const reportedReleaseDate = rawQ.reportedReleaseDate || getOfficialReportedReleaseDate(ticker, rawQ.fiscalDate);

      const q: QuarterlyFinancialPoint = {
        ...rawQ,
        displayLabel,
        releaseLabel: displayLabel,
        fiscalQuarterLabel,
        reportedReleaseDate
      };

      // Match the same fiscal report, not merely dates within 45 days.
      // A 45-day proximity rule can merge adjacent fiscal quarters for companies
      // whose fiscal calendar does not follow the calendar quarter.
      const existingIdx = deduped.findIndex(item =>
        (item.fiscalQuarterLabel && q.fiscalQuarterLabel && item.fiscalQuarterLabel === q.fiscalQuarterLabel) ||
        (item.fiscalDate && q.fiscalDate && item.fiscalDate === q.fiscalDate) ||
        (item.displayLabel && q.displayLabel && item.displayLabel === q.displayLabel)
      );

      if (existingIdx >= 0) {
        const cur = deduped[existingIdx];
        deduped[existingIdx] = {
          ...cur,
          ...q,
          // Preserve non-zero verified numbers
          revenue: (q.revenue && q.revenue > 0) ? q.revenue : cur.revenue,
          freeCashFlow: (q.freeCashFlow && q.freeCashFlow !== 0) ? q.freeCashFlow : cur.freeCashFlow,
          netIncome: (q.netIncome && q.netIncome !== 0) ? q.netIncome : cur.netIncome,
          eps: (q.eps !== undefined && q.eps !== null && q.eps !== 0) ? q.eps : cur.eps,
          fiscalQuarterLabel: cur.fiscalQuarterLabel || q.fiscalQuarterLabel,
          reportedReleaseDate: cur.reportedReleaseDate || q.reportedReleaseDate,
          displayLabel: cur.displayLabel || q.displayLabel,
          releaseLabel: cur.releaseLabel || q.releaseLabel
        };
      } else {
        deduped.push(q);
      }
    }

    const total = deduped.length;
    let sliceCount = 20; // 5 years = 20 quarters
    if (timeRange === '3Y') sliceCount = 12;
    if (timeRange === '1Y') sliceCount = 4;
    return deduped.slice(Math.max(0, total - sliceCount));
  }, [data, timeRange, ticker]);

  // Set default selected quarter to the latest public quarter if none is selected yet
  useEffect(() => {
    if (filteredQuarters.length > 0) {
      const publicQ = filteredQuarters.filter(q => !q.isPrePublic);
      const latest = publicQ.length > 0 ? publicQ[publicQ.length - 1] : filteredQuarters[filteredQuarters.length - 1];
      
      // Update selectedQuarter if not set or if current selected quarter is not in the filtered quarters
      setSelectedQuarter(prev => {
        if (!prev) return latest;
        const stillInList = filteredQuarters.find(q => q.fiscalDate === prev.fiscalDate || q.displayLabel === prev.displayLabel);
        return stillInList || latest;
      });
    }
  }, [filteredQuarters]);

  // Metric configuration
  const displayCurrency = data?.currency ? getCurrencySymbol(data.currency) : currency;
  const metricConfigs: Record<FinancialMetricKey, {
    label: string;
    shortLabel: string;
    unit: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    fillColor: string;
    barFill: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    formatter: (val: number) => string;
  }> = {
    revenue: {
      label: 'Omzet (Revenue)',
      shortLabel: 'Omzet',
      unit: 'Miljard',
      description: 'Totale bruto kwartaalomzet uit operationele activiteiten',
      icon: BarChart3,
      color: '#2563eb',
      fillColor: 'rgba(37, 99, 235, 0.15)',
      barFill: '#3b82f6',
      badgeBg: 'bg-blue-50',
      badgeText: 'text-blue-700',
      badgeBorder: 'border-blue-200',
      formatter: (val: number) => `${displayCurrency}${val.toFixed(2)}B`
    },
    freeCashFlow: {
      label: 'Free Cash Flow (FCF)',
      shortLabel: 'Free Cash Flow',
      unit: 'Miljard',
      description: 'Operationele kasstroom minus kapitaaluitgaven (CapEx)',
      icon: DollarSign,
      color: '#059669',
      fillColor: 'rgba(5, 150, 105, 0.15)',
      barFill: '#10b981',
      badgeBg: 'bg-emerald-50',
      badgeText: 'text-emerald-700',
      badgeBorder: 'border-emerald-200',
      formatter: (val: number) => `${displayCurrency}${val.toFixed(2)}B`
    },
    eps: {
      label: 'EPS (Winst per aandeel)',
      shortLabel: 'EPS',
      unit: `${displayCurrency} per aandeel`,
      description: 'Verwaterde nettowinst toegerekend per uitstaand aandeel',
      icon: Target,
      color: '#d97706',
      fillColor: 'rgba(217, 119, 6, 0.15)',
      barFill: '#f59e0b',
      badgeBg: 'bg-amber-50',
      badgeText: 'text-amber-700',
      badgeBorder: 'border-amber-200',
      formatter: (val: number) => `${displayCurrency}${val.toFixed(2)}`
    },
    netIncome: {
      label: 'Netto Winst / Verlies',
      shortLabel: 'Netto Winst',
      unit: 'Miljard',
      description: 'Onderstreept nettoresultaat na belastingen en rente',
      icon: TrendingUp,
      color: '#7c3aed',
      fillColor: 'rgba(124, 58, 237, 0.15)',
      barFill: '#8b5cf6',
      badgeBg: 'bg-purple-50',
      badgeText: 'text-purple-700',
      badgeBorder: 'border-purple-200',
      formatter: (val: number) => `${displayCurrency}${val.toFixed(2)}B`
    }
  };

  const activeConfig = metricConfigs[activeMetric];

  // Calculate key statistics for the active metric
  const stats = useMemo(() => {
    if (filteredQuarters.length === 0) return null;
    // Pre-public periods are intentionally shown as zeroes in the chart, but
    // must never contaminate financial statistics such as averages or YoY.
    const publicQuarters = filteredQuarters.filter(q => !q.isPrePublic);
    if (publicQuarters.length === 0) return null;
    const values = publicQuarters.map(q => q[activeMetric]);
    const latestQ = publicQuarters[publicQuarters.length - 1];
    const latestVal = latestQ[activeMetric];
    
    // Previous year same quarter (4 public quarters back)
    const prevYearQ = publicQuarters.length >= 5 
      ? publicQuarters[publicQuarters.length - 5] 
      : null;
    const yoyChange = prevYearQ && prevYearQ[activeMetric] !== 0
      ? ((latestVal - prevYearQ[activeMetric]) / Math.abs(prevYearQ[activeMetric])) * 100
      : null;

    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const avgVal = values.reduce((a, b) => a + b, 0) / values.length;
    
    // Earliest in range
    const firstVal = values[0];
    const totalGrowth = firstVal !== 0 
      ? ((latestVal - firstVal) / Math.abs(firstVal)) * 100 
      : 0;

    return {
      latestVal,
      latestQuarter: latestQ.releaseLabel || latestQ.quarter,
      yoyChange,
      maxVal,
      minVal,
      avgVal,
      totalGrowth
    };
  }, [filteredQuarters, activeMetric]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-4">
      {/* Top Header: Title, Provider Badge, Monthly Sync Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center flex-wrap gap-2">
            <h4 className="font-bold text-slate-900 text-sm font-mono-code flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Financiële Kerncijfers (Max. 5 Jaar Kwartaalhistorie)</span>
            </h4>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {ticker}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-1">
            <span className="inline-flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${data?.isLive === false ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></span>
              <strong className="text-slate-700">{data?.isLive === false ? 'Snapshot actief' : 'Live gesynchroniseerd'}</strong> via {data?.isLive === false ? 'Yahoo Finance — laatste bekende data' : 'Yahoo Finance'}
            </span>
            <span>•</span>
            <span className="font-mono-code text-slate-400">
              Laatste update: {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
            </span>
          </div>
        </div>

        {/* Action button: Refresh & Range Picker */}
        <div className="flex items-center gap-2">
          {/* Time range selector */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-[11px] font-mono-code">
            <button
              onClick={() => setTimeRange('5Y')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer font-semibold ${
                timeRange === '5Y' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              5 Jaar (20Q)
            </button>
            <button
              onClick={() => setTimeRange('3Y')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer font-semibold ${
                timeRange === '3Y' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              3 Jaar (12Q)
            </button>
            <button
              onClick={() => setTimeRange('1Y')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer font-semibold ${
                timeRange === '1Y' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              1 Jaar (4Q)
            </button>
          </div>

          {/* Refresh button */}
          <button
            onClick={() => fetchFinancials(true)}
            disabled={refreshing}
            title="Ververs data via live data provider"
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span className="hidden sm:inline">Verversen</span>
          </button>
        </div>
      </div>

      {data?.publicFinancialStartDate && (
        <div className="text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded-md px-2.5 py-2">
          <strong className="text-slate-700">Publieke historie:</strong> financiële kwartaaldata start bij {formatQuarterReleaseLabel(data.publicFinancialStartDate)}. Periodes vóór de eerste publieke kwartaalcijfers staan in de grafiek bewust op 0 en worden niet meegenomen in gemiddelden of YoY-berekeningen.
        </div>
      )}

      {/* USER REQUIREMENT:
          "ik wil niet 5 vijf verschillende grafieken met allemaal data zoals omzet, free cash flow, EPS en netto winst/verlies te gelijk zien maar een balk met opties om 1 per keer zien"
          -> PROMINENT SEGMENTED CONTROL OPTION BAR TO SHOW EXACTLY ONE METRIC AT A TIME! */}
      <div className="bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
          {(Object.keys(metricConfigs) as FinancialMetricKey[]).map((key) => {
            const config = metricConfigs[key];
            const Icon = config.icon;
            const isActive = activeMetric === key;
            return (
              <button
                key={key}
                onClick={() => setActiveMetric(key)}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? config.badgeText : 'text-slate-400'}`} />
                <span className="truncate">{config.shortLabel}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 hidden sm:inline-block"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Metric Summary Scorecard */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="bg-slate-50/80 border border-slate-200/70 rounded-lg p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Laatste ({stats.latestQuarter})
            </span>
            <div className="text-base font-bold font-mono-code text-slate-900 mt-0.5">
              {activeConfig.formatter(stats.latestVal)}
            </div>
            {stats.yoyChange !== null && (
              <span className={`inline-flex items-center text-[10px] font-bold mt-0.5 ${
                stats.yoyChange >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {stats.yoyChange >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                {stats.yoyChange >= 0 ? '+' : ''}{stats.yoyChange.toFixed(1)}% YoY
              </span>
            )}
          </div>

          <div className="bg-slate-50/80 border border-slate-200/70 rounded-lg p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              {timeRange} Piek (All-Time High)
            </span>
            <div className="text-base font-bold font-mono-code text-slate-900 mt-0.5">
              {activeConfig.formatter(stats.maxVal)}
            </div>
            <span className="text-[10px] text-slate-500 font-mono-code">
              Hoogste kwartaal
            </span>
          </div>

          <div className="bg-slate-50/80 border border-slate-200/70 rounded-lg p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Gemiddelde per kwartaal
            </span>
            <div className="text-base font-bold font-mono-code text-slate-800 mt-0.5">
              {activeConfig.formatter(stats.avgVal)}
            </div>
            <span className="text-[10px] text-slate-500 font-mono-code">
              {filteredQuarters.filter(q => !q.isPrePublic).length} publieke kwartalen
            </span>
          </div>

          <div className="bg-slate-50/80 border border-slate-200/70 rounded-lg p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Totale Groei ({timeRange})
            </span>
            <div className={`text-base font-bold font-mono-code mt-0.5 ${
              stats.totalGrowth >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}>
              {stats.totalGrowth >= 0 ? '+' : ''}{stats.totalGrowth.toFixed(1)}%
            </div>
            <span className="text-[10px] text-slate-500 font-mono-code">
              T.o.v. {filteredQuarters.filter(q => !q.isPrePublic)[0]?.releaseLabel || filteredQuarters.filter(q => !q.isPrePublic)[0]?.quarter}
            </span>
          </div>
        </div>
      )}

      {/* USER REQUIREMENT:
          "als ik op de staaf klik dat ik dan in het kaartje te zien krijg bijvoorbeeld fiscaal q2 2027 als dat het geval maar dan wel de precieze datum er naast van wanneer de kwartaalcijfers waren uitgekomen"
          -> Interactive Selected Quarter Detail Card ("kaartje") pinned on click/selection */}
      {selectedQuarter && (
        <div className="bg-slate-900 text-white rounded-xl p-3.5 sm:p-4 shadow-md border border-slate-800 transition-all animate-in fade-in">
          {/* Top row: Official Fiscal Quarter & Official Disclosure/Release Date directly next to it */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800">
            <div className="flex items-center flex-wrap gap-2">
              {/* Fiscal Quarter Badge (e.g. "Fiscaal Q2 2027") */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600/30 text-blue-300 font-bold text-xs border border-blue-500/40 font-mono-code shadow-xs">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>
                  {selectedQuarter.fiscalQuarterLabel || getOfficialFiscalQuarterLabel(
                    ticker,
                    selectedQuarter.fiscalDate,
                    selectedQuarter.quarter,
                    selectedQuarter.fiscalYear,
                    selectedQuarter.quarterNum
                  )}
                </span>
              </div>

              {/* Exact Earnings Release Date directly next to it */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-semibold text-xs border border-emerald-500/30 font-mono-code">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  Cijfers uitgekomen: <strong>{formatDutchDate(selectedQuarter.reportedReleaseDate || getOfficialReportedReleaseDate(ticker, selectedQuarter.fiscalDate))}</strong>
                </span>
              </div>

              {/* Fiscal Period End Date */}
              <span className="text-[11px] text-slate-400 font-mono-code">
                (Boekperiode eindigde: {formatDutchShortDate(selectedQuarter.fiscalDate)})
              </span>
            </div>

            {/* X-Axis standard date identifier */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono-code">
                X-as staaf: <strong className="text-white font-bold">{selectedQuarter.releaseLabel || selectedQuarter.displayLabel}</strong>
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800/80">
                Geselecteerd
              </span>
            </div>
          </div>

          {/* Core financial metrics for this selected quarter */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
            <div className="bg-slate-800/70 rounded-lg p-2.5 border border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Omzet (Revenue)
              </span>
              <div className="text-base font-bold font-mono-code text-blue-400 mt-0.5">
                {displayCurrency}{selectedQuarter.revenue.toFixed(2)}B
              </div>
            </div>

            <div className="bg-slate-800/70 rounded-lg p-2.5 border border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Free Cash Flow
              </span>
              <div className="text-base font-bold font-mono-code text-emerald-400 mt-0.5">
                {displayCurrency}{selectedQuarter.freeCashFlow.toFixed(2)}B
              </div>
            </div>

            <div className="bg-slate-800/70 rounded-lg p-2.5 border border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                EPS (Winst / Aandeel)
              </span>
              <div className="text-base font-bold font-mono-code text-amber-400 mt-0.5">
                {displayCurrency}{selectedQuarter.eps.toFixed(2)}
              </div>
            </div>

            <div className="bg-slate-800/70 rounded-lg p-2.5 border border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Netto Winst
              </span>
              <div className={`text-base font-bold font-mono-code mt-0.5 ${
                selectedQuarter.netIncome >= 0 ? 'text-purple-300' : 'text-rose-400'
              }`}>
                {displayCurrency}{selectedQuarter.netIncome.toFixed(2)}B
              </div>
            </div>
          </div>

          <div className="mt-2.5 text-[10px] text-slate-400 flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-slate-800/60">
            <span className="flex items-center gap-1 text-slate-300">
              <MousePointerClick className="w-3 h-3 text-blue-400" />
              <span>Klik op een andere staaf in de grafiek om direct de officiële fiscale periode en precieze publicatiedatum van dat kwartaal te zien.</span>
            </span>
            {selectedQuarter.isPrePublic && (
              <span className="text-amber-400 font-semibold font-mono-code">Vóór officiële beursnotering</span>
            )}
          </div>
        </div>
      )}

      {/* Main Single Chart Area (Max 5 years of quarters) */}
      <div className="relative pt-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 font-mono-code">
              {activeConfig.label} per Kwartaal ({timeRange})
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              — {activeConfig.description}
            </span>
          </div>

          {/* Bar / Area Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-md p-0.5 text-[10px] font-mono-code">
            <button
              onClick={() => setChartType('bar')}
              className={`px-2 py-0.5 rounded transition cursor-pointer ${
                chartType === 'bar' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Staven
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`px-2 py-0.5 rounded transition cursor-pointer ${
                chartType === 'area' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Trendlijn
            </button>
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2 border border-slate-100 rounded-xl bg-slate-50/50">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs font-mono-code">Financiële kwartaalhistorie ophalen...</span>
          </div>
        ) : filteredQuarters.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2 border border-slate-100 rounded-xl bg-slate-50/50">
            <Info className="w-6 h-6 text-slate-400" />
            <span className="text-xs font-mono-code">Geen kwartaaldata beschikbaar</span>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart 
                  data={filteredQuarters} 
                  margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
                  onClick={(state: any) => {
                    if (state && state.activePayload && state.activePayload.length) {
                      const item = state.activePayload[0].payload;
                      if (item) setSelectedQuarter(item);
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="metricGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={activeConfig.color} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={activeConfig.color} stopOpacity={0.5} />
                    </linearGradient>
                    <linearGradient id="negativeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e11d48" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#e11d48" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="releaseLabel" 
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    interval={filteredQuarters.length > 12 ? 1 : 0}
                    angle={-35}
                    textAnchor="end"
                    height={35}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(val) => activeMetric === 'eps' ? `${currency}${val}` : `${currency}${val}B`}
                  />
                  <Tooltip 
                    content={<CustomFinancialTooltip activeConfig={activeConfig} currency={currency} ticker={ticker} />} 
                  />
                  <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
                  <Bar 
                    dataKey={activeMetric} 
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                    cursor="pointer"
                    onClick={(entry: any) => {
                      const q = entry?.payload || entry;
                      if (q) setSelectedQuarter(q);
                    }}
                  >
                    {filteredQuarters.map((entry, index) => {
                      const val = entry[activeMetric];
                      const isNegative = val < 0;
                      const isSelected = selectedQuarter?.fiscalDate === entry.fiscalDate || 
                        (selectedQuarter?.displayLabel === entry.displayLabel && Boolean(entry.displayLabel));
                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={isNegative ? 'url(#negativeGradient)' : 'url(#metricGradient)'} 
                          stroke={isSelected ? '#1e293b' : 'none'}
                          strokeWidth={isSelected ? 2.5 : 0}
                          className="transition-all hover:opacity-85 cursor-pointer"
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              ) : (
                <AreaChart 
                  data={filteredQuarters} 
                  margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
                  onClick={(state: any) => {
                    if (state && state.activePayload && state.activePayload.length) {
                      const item = state.activePayload[0].payload;
                      if (item) setSelectedQuarter(item);
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={activeConfig.color} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={activeConfig.color} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="releaseLabel" 
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    interval={filteredQuarters.length > 12 ? 1 : 0}
                    angle={-35}
                    textAnchor="end"
                    height={35}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(val) => activeMetric === 'eps' ? `${currency}${val}` : `${currency}${val}B`}
                  />
                  <Tooltip 
                    content={<CustomFinancialTooltip activeConfig={activeConfig} currency={currency} ticker={ticker} />} 
                  />
                  <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
                  <Area 
                    type="monotone" 
                    dataKey={activeMetric} 
                    stroke={activeConfig.color} 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#areaGradient)" 
                    dot={{ r: 3, fill: activeConfig.color, strokeWidth: 1, stroke: '#fff', cursor: 'pointer' }}
                    activeDot={{ 
                      r: 6, 
                      strokeWidth: 2.5, 
                      stroke: '#fff',
                      onClick: (_e: any, payload: any) => {
                        if (payload?.payload) setSelectedQuarter(payload.payload);
                      }
                    }}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Collapsible Full Financial Data Table */}
      <div className="border-t border-slate-100 pt-2">
        <button
          onClick={() => setShowTable(!showTable)}
          className="flex items-center justify-between w-full py-1.5 px-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition cursor-pointer font-mono-code"
        >
          <span className="flex items-center gap-1.5">
            <TableIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>Bekijk Kwartaalcijfers Tabel ({filteredQuarters.filter(q => !q.isPrePublic).length} publieke kwartalen)</span>
          </span>
          {showTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showTable && (
          <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-[11px] text-left">
              <thead className="bg-slate-50 text-slate-600 font-mono-code border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 font-semibold">Periode</th>
                  <th className="py-2 px-3 font-semibold">Einddatum</th>
                  <th className="py-2 px-3 font-semibold text-right">Omzet</th>
                  <th className="py-2 px-3 font-semibold text-right">Free Cash Flow</th>
                  <th className="py-2 px-3 font-semibold text-right">EPS</th>
                  <th className="py-2 px-3 font-semibold text-right">Netto Winst</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono-code">
                {[...filteredQuarters].filter(q => !q.isPrePublic).reverse().map((q, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition">
                    <td className="py-2 px-3 font-bold text-slate-900">
                      {q.releaseLabel || q.quarter}
                    </td>
                    <td className="py-2 px-3 text-slate-500">{q.fiscalDate}</td>
                    <td className="py-2 px-3 text-right font-bold text-blue-700">{displayCurrency}{q.revenue.toFixed(2)}B</td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-700">{displayCurrency}{q.freeCashFlow.toFixed(2)}B</td>
                    <td className="py-2 px-3 text-right font-bold text-amber-700">{displayCurrency}{q.eps.toFixed(2)}</td>
                    <td className={`py-2 px-3 text-right font-bold ${q.netIncome >= 0 ? 'text-purple-700' : 'text-rose-700'}`}>
                      {displayCurrency}{q.netIncome.toFixed(2)}B
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// Custom interactive Tooltip for the chart
const CustomFinancialTooltip = ({ active, payload, label, activeConfig, currency, ticker }: any) => {
  if (active && payload && payload.length) {
    const dataPoint: QuarterlyFinancialPoint = payload[0].payload;
    const value = payload[0].value;
    const isNegative = value < 0;

    const fiscalLabel = dataPoint.fiscalQuarterLabel || getOfficialFiscalQuarterLabel(
      ticker,
      dataPoint.fiscalDate,
      dataPoint.quarter,
      dataPoint.fiscalYear,
      dataPoint.quarterNum
    );
    const releaseDate = dataPoint.reportedReleaseDate || getOfficialReportedReleaseDate(ticker, dataPoint.fiscalDate);

    return (
      <div className="bg-slate-900 text-white rounded-xl p-3 shadow-xl border border-slate-800 text-xs font-mono-code min-w-[210px] z-50">
        <div className="flex flex-col gap-1 pb-2 mb-2 border-b border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-blue-400 bg-blue-950/90 px-2 py-0.5 rounded text-[11px] border border-blue-800/80">
              {fiscalLabel}
            </span>
            <span className="text-[10px] text-slate-400">
              X-as: {dataPoint.releaseLabel || dataPoint.displayLabel}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-emerald-400 pt-0.5">
            <span className="text-slate-400 text-[10px]">Cijfers uitgekomen:</span>
            <span className="font-bold">{formatDutchShortDate(releaseDate)}</span>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>Boekperiode eind:</span>
            <span>{formatDutchShortDate(dataPoint.fiscalDate)}</span>
          </div>
        </div>

        {dataPoint.isPrePublic && (
          <div className="text-[10px] text-amber-400 mb-2">Voor beursnotering / geen publieke kwartaalcijfers</div>
        )}

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-400">{activeConfig.shortLabel}:</span>
            <span className={`font-bold ${isNegative ? 'text-rose-400' : 'text-emerald-400'}`}>
              {activeConfig.formatter(value)}
            </span>
          </div>

          {/* Quick glance at other metrics in tooltip */}
          <div className="pt-1.5 mt-1.5 border-t border-slate-800/80 text-[10px] text-slate-400 space-y-0.5">
            <div className="flex justify-between">
              <span>Omzet:</span>
              <span className="text-slate-300 font-semibold">{currency}{dataPoint.revenue.toFixed(2)}B</span>
            </div>
            <div className="flex justify-between">
              <span>Free Cash Flow:</span>
              <span className="text-slate-300 font-semibold">{currency}{dataPoint.freeCashFlow.toFixed(2)}B</span>
            </div>
            <div className="flex justify-between">
              <span>EPS:</span>
              <span className="text-slate-300 font-semibold">{currency}{dataPoint.eps.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Netto Winst:</span>
              <span className="text-slate-300 font-semibold">{currency}{dataPoint.netIncome.toFixed(2)}B</span>
            </div>
          </div>

          <div className="text-[9px] text-slate-400 pt-1.5 text-center border-t border-slate-800/60">
            Klik op staaf om kaartje vast te zetten
          </div>
        </div>
      </div>
    );
  }
  return null;
};
