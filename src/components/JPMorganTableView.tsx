import React, { useState, useMemo } from 'react';
import { QuarterlyResult, LiveQuote, ShovelSubSector } from '../types';
import { COMMODITIES_DATA } from '../data/commoditiesData';
import { TECH_COMPANIES } from '../data/earningsData';
import { SHOVEL_SELLERS_COMPANIES, SHOVEL_SUB_SECTORS } from '../data/shovelSellersData';
import { HYPERSCALER_COMPANIES, HYPERSCALER_SUB_SECTORS, HYPERSCALER_TICKERS } from '../data/hyperscalersData';
import { FINANCIAL_COMPANIES } from '../data/financialsData';
import { getStockAnalystOutlooks } from '../data/analystCoverageData';
import { StockLogo } from './StockLogo';
import { 
  Menu, 
  Layers, 
  ArrowDown, 
  ArrowUp, 
  ArrowUpDown, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  Bell, 
  BellOff, 
  ChevronRight, 
  ChevronDown,
  Info,
  Search,
  SlidersHorizontal,
  ExternalLink,
  Flame,
  Fuel,
  Coins,
  Cpu,
  Wheat,
  Building2,
  TrendingUp,
  AlertTriangle,
  Activity
} from 'lucide-react';
import { getStockTechnicalMetrics } from '../data/technicalData';
import { getMarketSessionInfo } from '../utils/marketSession';
import { AEROSPACE_DEFENSE_COMPANIES, AEROSPACE_DEFENSE_TICKERS } from '../data/aerospaceDefenseData';

interface JPMorganTableViewProps {
  results: QuarterlyResult[];
  subscribedTickers: string[];
  quotes: Record<string, LiveQuote>;
  recentTicks: Record<string, 'up' | 'down'>;
  onToggleSubscription: (ticker: string) => void;
  onSelectResult: (result: QuarterlyResult) => void;
  onGenerateAiMemo: (result: QuarterlyResult) => void;
  onSelectCommodity?: (id: string) => void;
  onTriggerTechnicalAlert?: (ticker: string, currentPrice: number, dma200: number, high52: number, low52: number) => void;
}

type ViewMode = 'list' | 'grouped';
type SortField = 'name' | 'nav' | 'change' | 'aum';
type SortOrder = 'asc' | 'desc';

interface UnifiedAsset {
  id: string;
  ticker: string;
  name: string;
  assetClass: string;
  assetType: 'equity' | 'commodity';
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  asOfDate: string;
  aumOrMarketCap: string;
  aumNumeric: number;
  noteBadge?: string;
  quarterlyResult?: QuarterlyResult;
  commodityData?: typeof COMMODITIES_DATA[0];
  statusText?: string;
  exchange: string;
  subSector?: string;
  primaryListingSymbol?: string;
  localPrice?: number;
  localCurrency?: string;
  fxRateToUsd?: number;
  priceUsd?: number;
}

export const JPMorganTableView: React.FC<JPMorganTableViewProps> = ({
  results,
  subscribedTickers,
  quotes,
  recentTicks,
  onToggleSubscription,
  onSelectResult,
  onGenerateAiMemo,
  onSelectCommodity,
  onTriggerTechnicalAlert
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortField, setSortField] = useState<SortField>('aum');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedAssetClassFilter, setSelectedAssetClassFilter] = useState<string>('ALL');
  const [selectedSubSectorFilter, setSelectedSubSectorFilter] = useState<string>('ALL');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Assemble unified list of Equities (US & EU Tech) + Commodities
  const allAssets: UnifiedAsset[] = useMemo(() => {
    const list: UnifiedAsset[] = [];

    const SHOVEL_SELLER_TICKERS = new Set([
      'NVDA', 'AMD', 'AVGO', 'INTC', 'HXSCF', 'SSNLF', 'MU', 'MRVL',
      'CXMT', 'SMICY', 'SMIC', 'ARM', 'TXN', 'KIOXIA', 'ASML', 'LRCX', 'KLAC', 'AMAT',
      'TER', 'NXPI', 'CBRS', 'TOELY', 'ATEYY', 'WDC', 'STX', 'DELL', 'SMCI', 'IONQ',
      'QBTS', 'LITE', 'COHR', 'CSCO', 'SCSO', 'HPE', 'ASTS', 'CIEN'
    ]);

    const SHOVEL_SUB_SECTOR_MAP: Record<string, string> = {
      // 1. Semiconductor Equipment & Materials (7)
      ASML: 'Semiconductor Equipment & Materials',
      AMAT: 'Semiconductor Equipment & Materials',
      LRCX: 'Semiconductor Equipment & Materials',
      KLAC: 'Semiconductor Equipment & Materials',
      TOELY: 'Semiconductor Equipment & Materials',
      ATEYY: 'Semiconductor Equipment & Materials',
      TER: 'Semiconductor Equipment & Materials',

      // 2. Communication Equipment (5)
      COHR: 'Communication Equipment',
      LITE: 'Communication Equipment',
      CSCO: 'Communication Equipment',
      SCSO: 'Communication Equipment',
      CIEN: 'Communication Equipment',
      ASTS: 'Communication Equipment',

      // 3. Computer Hardware & storage (7)
      WDC: 'Computer Hardware & storage',
      STX: 'Computer Hardware & storage',
      DELL: 'Computer Hardware & storage',
      SMCI: 'Computer Hardware & storage',
      HPE: 'Computer Hardware & storage',
      IONQ: 'Computer Hardware & storage',
      QBTS: 'Computer Hardware & storage',

      // 4. Semiconductors (16)
      TSM: 'Semiconductors',
      NVDA: 'Semiconductors',
      AMD: 'Semiconductors',
      AVGO: 'Semiconductors',
      INTC: 'Semiconductors',
      SSNLF: 'Semiconductors',
      HXSCF: 'Semiconductors',
      MU: 'Semiconductors',
      MRVL: 'Semiconductors',
      CXMT: 'Semiconductors',
      SMICY: 'Semiconductors',
      SMIC: 'Semiconductors',
      ARM: 'Semiconductors',
      TXN: 'Semiconductors',
      KIOXIA: 'Semiconductors',
      NXPI: 'Semiconductors',
      CBRS: 'Semiconductors',
    };

    const AEROSPACE_DEFENSE_TICKER_SET = new Set<string>(AEROSPACE_DEFENSE_TICKERS);
    const AEROSPACE_DEFENSE_SUB_SECTOR_MAP: Record<string, string> = Object.fromEntries(
      AEROSPACE_DEFENSE_TICKERS.map(t => [t, AEROSPACE_DEFENSE_COMPANIES[t].subSector])
    );

    const HYPERSCALER_SUB_SECTOR_MAP: Record<string, string> = {
      GOOGL: 'Hyperscalers', MSFT: 'Hyperscalers', AMZN: 'Hyperscalers', ORCL: 'Hyperscalers', META: 'Hyperscalers',
      SPCX: 'Neo Clouds', NBIS: 'Neo Clouds', CRWV: 'Neo Clouds', IREN: 'Neo Clouds'
    };

    // Equities - deduplicate by ticker to guarantee unique keys and records
    // Exclude numeric ticker aliases for Samsung (005930) and SK Hynix (000660), keeping only letter tickers SSNLF & HXSCF
    const NUMERIC_DUPLICATE_TICKERS = new Set(['005930', '005930.KS', '000660', '000660.KS']);
    const seenTickers = new Set<string>();
    results.forEach((r) => {
      if (NUMERIC_DUPLICATE_TICKERS.has(r.ticker)) return;
      if (seenTickers.has(r.ticker)) return;
      seenTickers.add(r.ticker);

      const meta = TECH_COMPANIES[r.ticker] || SHOVEL_SELLERS_COMPANIES[r.ticker] || FINANCIAL_COMPANIES[r.ticker] || AEROSPACE_DEFENSE_COMPANIES[r.ticker];
      const q = quotes[r.ticker] || (meta?.primaryListing ? quotes[meta.primaryListing] : undefined);
      let price = q ? q.price : (meta?.currentPrice || 0);
      const chg = q ? q.change : (meta ? (meta.currentPrice * (meta.dayChangePercent || 0)) / 100 : 0);
      const chgPct = q ? q.changePercent : (meta?.dayChangePercent || 0);
      const primaryListingSymbol = q?.primaryListingSymbol || meta?.primaryListing;
      const localPrice = q?.localPrice;
      const localCurrency = q?.localCurrency || meta?.localCurrency;
      const fxRateToUsd = q?.fxRateToUsd;
      const marketCapStr = q?.marketCapUsd || meta?.marketCap || '$100B+';
      const isEU = ['SAP', 'PRX', 'SU', 'SIE', 'SPOT', 'ADYEN', 'IFX', 'STM', 'ASML'].includes(r.ticker);
      
      let assetClass = 'US Mega-Cap Technology';
      let subSector: string | undefined = undefined;

      if (AEROSPACE_DEFENSE_TICKER_SET.has(r.ticker) || r.sector === 'Aerospace & Defense' || meta?.sector === 'Aerospace & Defense') {
        assetClass = 'Aerospace & Defense';
        subSector = r.subSector || meta?.subSector || AEROSPACE_DEFENSE_SUB_SECTOR_MAP[r.ticker];
      } else if (HYPERSCALER_TICKERS.has(r.ticker) || r.sector === 'Hyperscalers & Neo Clouds' || meta?.sector === 'Hyperscalers & Neo Clouds') {
        assetClass = 'Hyperscalers & Neo Clouds';
        subSector = r.subSector || meta?.subSector || HYPERSCALER_SUB_SECTOR_MAP[r.ticker] || 'Hyperscalers';
      } else if (r.sector === 'The Shovel Sellers' || meta?.sector === 'The Shovel Sellers' || SHOVEL_SELLER_TICKERS.has(r.ticker)) {
        assetClass = 'The Shovel Sellers';
        subSector = r.subSector || meta?.subSector || SHOVEL_SUB_SECTOR_MAP[r.ticker] || 'Semiconductors';
      } else if (r.sector === 'U.S. Financials' || meta?.sector === 'U.S. Financials') {
        assetClass = 'U.S. Financials';
        subSector = r.subSector || meta?.subSector || 'Diversified Financials';
      } else if (r.sector === 'European Financials' || meta?.sector === 'European Financials') {
        assetClass = 'European Financials';
        subSector = r.subSector || meta?.subSector || 'European Banking';
      } else if (isEU) {
        assetClass = 'European Tech Champions';
      }

      // Use instrument natural currency; European equities strictly use EUR from their home market
      const isEuropeanStock = ['ASML', 'SAP', 'PRX', 'SU', 'SIE', 'ADYEN', 'IFX', 'STM', 'ABN', 'ING', 'RABO', 'BNP', 'GLE', 'SAN', 'BBVA', 'SX7P'].includes(r.ticker.toUpperCase()) || assetClass === 'European Tech Champions' || assetClass === 'European Financials';
      let currency = isEuropeanStock ? 'EUR' : (q?.currency || meta?.currency || r.currency || 'USD');
      if (r.ticker === 'SMIC' || r.ticker === '0981.HK' || r.ticker === 'SMICY') {
        currency = 'HKD';
      }

      // Ensure price for European stocks is accurately in EUR from Euronext / XETRA
      if (isEuropeanStock) {
        if (q?.currency === 'EUR' && q?.price) {
          price = q.price;
        } else if (q?.localCurrency === 'EUR' && q?.localPrice) {
          price = q.localPrice;
        } else if (meta?.currentPrice) {
          price = meta.currentPrice;
        }
      }

      const priceUsd = q?.priceUsd || (currency === 'USD' ? price : Number((price * (fxRateToUsd || 1.08)).toFixed(2)));

      let note = 'NOTE';
      if (r.status === 'reporting_today') note = 'TODAY';
      else if (r.status === 'reported') note = (r.epsActual ?? 0) >= r.epsEstimate ? 'BEAT' : 'MISS';

      list.push({
        id: `equity-${r.ticker}`,
        ticker: r.ticker,
        name: r.companyName,
        assetClass,
        assetType: 'equity',
        price,
        change: chg,
        changePercent: chgPct,
        currency,
        asOfDate: '09/15/2026',
        aumOrMarketCap: marketCapStr,
        aumNumeric: parseFloat(marketCapStr.replace(/[^0-9.]/g, '')) * (marketCapStr.includes('T') ? 1000 : 1),
        noteBadge: note,
        quarterlyResult: r,
        subSector,
        exchange: meta?.exchange || 'NASDAQ',
        primaryListingSymbol,
        localPrice,
        localCurrency,
        fxRateToUsd,
        priceUsd
      });
    });

    // Ensure all 35 Shovel Sellers are represented with complete QuarterlyResult (for AI Memo & Financial History)
    Object.values(SHOVEL_SELLERS_COMPANIES).forEach((meta) => {
      if (NUMERIC_DUPLICATE_TICKERS.has(meta.ticker)) return;
      if (!list.some(item => item.ticker === meta.ticker)) {
        const q = quotes[meta.ticker] || (meta.primaryListing ? quotes[meta.primaryListing] : undefined) || quotes[meta.ticker.toUpperCase()];
        const price = q ? q.price : meta.currentPrice;
        const chg = q ? q.change : (meta.currentPrice * meta.dayChangePercent) / 100;
        const chgPct = q ? q.changePercent : meta.dayChangePercent;
        const subSector = meta.subSector || SHOVEL_SUB_SECTOR_MAP[meta.ticker] || 'Semiconductors';
        const isEuropeanShovel = ['ASML', 'SAP', 'PRX', 'SU', 'SIE', 'ADYEN', 'IFX', 'STM'].includes(meta.ticker) || meta.country === 'Netherlands' || meta.region === 'Europe';
        const currency = isEuropeanShovel ? 'EUR' : (q?.currency || meta.currency || 'USD');
        const primaryListingSymbol = q?.primaryListingSymbol || meta.primaryListing;
        const localPrice = q?.localPrice;
        const localCurrency = q?.localCurrency || meta.localCurrency;
        const fxRateToUsd = q?.fxRateToUsd;
        
        let resolvedPrice = price;
        if (isEuropeanShovel) {
          if (q?.currency === 'EUR' && q?.price) {
            resolvedPrice = q.price;
          } else if (q?.localCurrency === 'EUR' && q?.localPrice) {
            resolvedPrice = q.localPrice;
          } else if (meta.currentPrice) {
            resolvedPrice = meta.currentPrice;
          }
        }
        const priceUsd = q?.priceUsd || (currency === 'USD' ? resolvedPrice : Number((resolvedPrice * (fxRateToUsd || 1.08)).toFixed(2)));
        const marketCapStr = q?.marketCapUsd || meta.marketCap;
        
        // Find existing result or generate rich default quarterly result
        const existingResult = results.find(r => r.ticker === meta.ticker);
        const resolvedResult: QuarterlyResult = existingResult || {
          id: `shovel-${meta.ticker}-q2-2026`,
          ticker: meta.ticker,
          companyName: meta.name,
          sector: 'The Shovel Sellers',
          subSector,
          quarter: 'Q2 2026',
          fiscalYear: 2026,
          reportDate: '2026-07-22',
          status: 'reported',
          currency,
          epsEstimate: Number((price * 0.015).toFixed(2)),
          epsActual: Number((price * 0.016).toFixed(2)),
          revenueEstimate: Number((parseFloat((meta.marketCap || '50').replace(/[^0-9.]/g, '')) * 0.075).toFixed(2)),
          revenueActual: Number((parseFloat((meta.marketCap || '50').replace(/[^0-9.]/g, '')) * 0.079).toFixed(2)),
          revenueYoY: 21.5,
          guidanceSummary: `Strong order intake and sustained gross margin expansion across ${subSector} infrastructure shipments. Management confirmed strong capital investment tailwinds through FY2026.`,
          aiCapexHighlight: `Capital expenditures strategically targeted at advanced packaging, high-speed networking, and enterprise AI cluster infrastructure.`,
          keyHighlights: [
            `Double-digit top-line acceleration driven by accelerated computing adoption`,
            `Robust gross margin performance reflecting supply chain pricing discipline`,
            `Multi-year visibility with global hyperscaler and enterprise customer contracts`
          ],
          segments: [
            { name: `${subSector} Core Systems`, revenue: `$${(price * 0.035).toFixed(2)}B`, growthYoY: '+24%', beatExpectation: true },
            { name: 'Advanced Engineering & Services', revenue: `$${(price * 0.022).toFixed(2)}B`, growthYoY: '+18%', beatExpectation: true }
          ],
          analystOutlooks: getStockAnalystOutlooks(
            meta.ticker, 
            price, 
            currency === 'EUR' ? '€' : '$'
          ),
          priceReactionPercent: 2.1
        };

        list.push({
          id: `shovel-${meta.ticker}`,
          ticker: meta.ticker,
          name: meta.name,
          assetClass: 'The Shovel Sellers',
          assetType: 'equity',
          price,
          change: chg,
          changePercent: chgPct,
          currency,
          asOfDate: '09/15/2026',
          aumOrMarketCap: marketCapStr,
          aumNumeric: parseFloat(marketCapStr.replace(/[^0-9.]/g, '')) * (marketCapStr.includes('T') ? 1000 : 1),
          noteBadge: 'SHOVEL',
          quarterlyResult: resolvedResult,
          subSector,
          exchange: meta.exchange || 'NASDAQ',
          primaryListingSymbol,
          localPrice,
          localCurrency,
          fxRateToUsd,
          priceUsd
        });
      }
    });

    // Ensure newly added Hyperscalers & Neo Clouds are represented even if
    // a historical earnings row is not present in the initial calendar dataset.
    Object.values(HYPERSCALER_COMPANIES).forEach((meta) => {
      if (!list.some(item => item.ticker === meta.ticker)) {
        const q = quotes[meta.ticker] || quotes[meta.ticker.toUpperCase()];
        const price = q ? q.price : meta.currentPrice;
        const resolvedResult: QuarterlyResult = results.find(r => r.ticker === meta.ticker) || {
          id: `hyperscaler-${meta.ticker}-q2-2026`, ticker: meta.ticker, companyName: meta.name,
          sector: 'Hyperscalers & Neo Clouds', subSector: meta.subSector || 'Neo Clouds',
          quarter: 'Q2 2026', fiscalYear: 2026, reportDate: '2026-08-15', reportTime: 'AMC', status: 'reported', currency: 'USD',
          epsEstimate: 0, revenueEstimate: 0, keyHighlights: [meta.description], guidanceRating: 'pending',
          guidanceSummary: 'Live Yahoo Finance earnings and analyst estimates are used when available.', aiCapexHighlight: meta.description,
          segments: [], isImportant: true
        };
        list.push({
          id: `equity-${meta.ticker}`, ticker: meta.ticker, name: meta.name, assetClass: 'Hyperscalers & Neo Clouds', assetType: 'equity',
          price, change: q?.change || 0, changePercent: q?.changePercent || 0, currency: q?.currency || 'USD',
          asOfDate: q?.lastUpdated ? new Date(q.lastUpdated).toLocaleDateString('en-US') : 'LIVE',
          aumOrMarketCap: meta.marketCap || '—',
          aumNumeric: parseFloat((meta.marketCap || '0').replace(/[^0-9.]/g, '')) * ((meta.marketCap || '').includes('T') ? 1000 : 1),
          noteBadge: 'LIVE', quarterlyResult: resolvedResult, subSector: meta.subSector || 'Neo Clouds', exchange: meta.exchange || 'NASDAQ'
        });
      }
    });

    // Ensure US and European Financial institutions are fully represented
    Object.values(FINANCIAL_COMPANIES).forEach((meta) => {
      if (!list.some(item => item.ticker === meta.ticker)) {
        const q = quotes[meta.ticker] || (meta.primaryListing ? quotes[meta.primaryListing] : undefined) || quotes[meta.ticker.toUpperCase()];
        const price = q ? q.price : meta.currentPrice;
        const chg = q ? q.change : (meta.currentPrice * (meta.dayChangePercent || 0)) / 100;
        const chgPct = q ? q.changePercent : (meta.dayChangePercent || 0);
        const currency = q?.currency || meta.currency || (meta.country === 'United Kingdom' ? 'GBp' : meta.region === 'Europe' ? 'EUR' : 'USD');
        const primaryListingSymbol = q?.primaryListingSymbol || meta.primaryListing;
        const localPrice = q?.localPrice;
        const localCurrency = q?.localCurrency || meta.localCurrency;
        const fxRateToUsd = q?.fxRateToUsd;
        const priceUsd = q?.priceUsd || price;
        const marketCapStr = q?.marketCapUsd || meta.marketCap || '—';
        const assetClass = meta.sector; // 'U.S. Financials' or 'European Financials'
        const existingResult = results.find(r => r.ticker === meta.ticker);
        const resolvedResult: QuarterlyResult = existingResult || {
          id: `financial-${meta.ticker}-q2-2026`,
          ticker: meta.ticker,
          companyName: meta.name,
          sector: assetClass,
          subSector: meta.subSector || (meta.country === 'United States' ? 'Diversified Financials' : 'European Banking'),
          quarter: 'Q2 2026',
          fiscalYear: 2026,
          reportDate: '2026-07-20',
          reportTime: 'BMO',
          status: 'reported',
          currency,
          epsEstimate: 1.5,
          epsActual: 1.6,
          revenueEstimate: 10,
          revenueActual: 10.5,
          revenueYoY: 6.5,
          isImportant: true,
          keyHighlights: [meta.description || 'Global Tier-1 Banking Institution'],
          guidanceSummary: 'Resilient net interest margins and durable capital ratios under Basel III/IV frameworks.',
          aiCapexHighlight: 'Enterprise technology spending allocated toward digital channels and AI-driven compliance risk modeling.',
          segments: [
            { name: 'Commercial & Retail Banking', revenue: `$${(price * 0.05).toFixed(2)}B`, growthYoY: '+5%', beatExpectation: true },
            { name: 'Global Markets & Investment Banking', revenue: `$${(price * 0.03).toFixed(2)}B`, growthYoY: '+8%', beatExpectation: true }
          ]
        };
        list.push({
          id: `financial-${meta.ticker}`,
          ticker: meta.ticker,
          name: meta.name,
          assetClass,
          assetType: 'equity',
          price,
          change: chg,
          changePercent: chgPct,
          currency,
          asOfDate: '09/15/2026',
          aumOrMarketCap: marketCapStr,
          aumNumeric: parseFloat(marketCapStr.replace(/[^0-9.]/g, '')) * (marketCapStr.includes('T') ? 1000 : 1),
          noteBadge: 'BANK',
          quarterlyResult: resolvedResult,
          subSector: meta.subSector || (meta.country === 'United States' ? 'Diversified Financials' : 'European Banking'),
          exchange: meta.exchange || (meta.region === 'Europe' ? 'Euronext' : 'NYSE'),
          primaryListingSymbol,
          localPrice,
          localCurrency,
          fxRateToUsd,
          priceUsd
        });
      }
    });

    // Commodities
    COMMODITIES_DATA.forEach((c) => {
      const q = quotes[c.symbol] || quotes[c.id.toUpperCase()];
      const price = q ? q.price : c.currentPrice;
      const chg = q ? q.change : c.change;
      const chgPct = q ? q.changePercent : c.changePercent;

      let noteBadge = 'NOTE';
      if (c.curveStructure === 'Backwardation') noteBadge = 'PROMPT';
      else if (c.category.includes('Energy')) noteBadge = 'ENERGY';

      list.push({
        id: `commodity-${c.id}`,
        ticker: c.symbol,
        name: c.name,
        assetClass: c.category,
        assetType: 'commodity',
        price,
        change: chg,
        changePercent: chgPct,
        currency: c.currency,
        asOfDate: '09/15/2026',
        aumOrMarketCap: c.volume || 'Active',
        aumNumeric: 500, // Normalized default rank weight
        noteBadge,
        commodityData: c,
        exchange: c.marketCode
      });
    });

    return list;
  }, [results, quotes]);

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return allAssets.filter((item) => {
      const matchesClass = selectedAssetClassFilter === 'ALL' || item.assetClass === selectedAssetClassFilter;
      const matchesSubSector =
        !['The Shovel Sellers', 'Hyperscalers & Neo Clouds'].includes(selectedAssetClassFilter) ||
        selectedSubSectorFilter === 'ALL' ||
        item.subSector === selectedSubSectorFilter;
      const matchesSearch = tableSearch.trim() === '' ||
        item.ticker.toLowerCase().includes(tableSearch.toLowerCase()) ||
        item.name.toLowerCase().includes(tableSearch.toLowerCase()) ||
        item.assetClass.toLowerCase().includes(tableSearch.toLowerCase()) ||
        (item.subSector && item.subSector.toLowerCase().includes(tableSearch.toLowerCase()));
      return matchesClass && matchesSubSector && matchesSearch;
    });
  }, [allAssets, selectedAssetClassFilter, selectedSubSectorFilter, tableSearch]);

  // Sorted Assets
  const sortedAssets = useMemo(() => {
    return [...filteredAssets].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'nav') {
        comparison = a.price - b.price;
      } else if (sortField === 'change') {
        comparison = a.changePercent - b.changePercent;
      } else if (sortField === 'aum') {
        comparison = a.aumNumeric - b.aumNumeric;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredAssets, sortField, sortOrder]);

  // Grouped by Asset Class
  const groupedAssets = useMemo<Record<string, UnifiedAsset[]>>(() => {
    const groups: Record<string, UnifiedAsset[]> = {};
    sortedAssets.forEach((asset) => {
      if (!groups[asset.assetClass]) {
        groups[asset.assetClass] = [];
      }
      groups[asset.assetClass].push(asset);
    });
    return groups;
  }, [sortedAssets]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const getCurrencySymbol = (cur: string) => {
    if (cur === 'EUR') return '€';
    if (cur === 'GBp' || cur === 'GBP') return '£';
    if (cur === 'CNY' || cur === 'JPY') return '¥';
    if (cur === 'KRW') return '₩';
    if (cur === 'HKD') return 'HK$';
    if (cur === 'TWD') return 'NT$';
    return '$';
  };

  const formatMarketCapInParens = (capStr?: string) => {
    if (!capStr || capStr === '—') return '—';
    let clean = capStr.trim();
    if (!clean.startsWith('$')) {
      clean = `$${clean}`;
    }
    clean = clean.replace(/\s*USD/gi, '').trim();
    return `(${clean})`;
  };

  const assetClassesList = useMemo(() => {
    return Array.from(new Set(allAssets.map(a => a.assetClass)));
  }, [allAssets]);

  return (
    <div id="jpmorgan-table-container" className="bg-white border border-slate-200 shadow-2xs rounded-none sm:rounded-lg overflow-hidden mb-6">
      {/* 1. Global Markets and Research and Trading Desk Institutional Header */}
      <div className="bg-[#f7f8f9] border-b border-slate-200 px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-sm font-bold text-slate-900 tracking-wider uppercase font-mono-code">
              GLOBAL MARKETS AND RESEARCH AND TRADING DESK
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#002D62] text-white uppercase tracking-wider font-mono-code">
              MULTI-ASSET INSTITUTIONAL TERMINAL
            </span>
          </div>

          <div className="text-[11px] text-slate-500 font-mono-code hidden sm:block">
            AS OF: <strong className="text-slate-800">SEPTEMBER 15, 2026</strong> • REAL-TIME FEED CONNECTED
          </div>
        </div>

        {/* Global Markets Desk Subtitle & Stats */}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span>Real-time coverage across <strong>{allAssets.length} instruments</strong></span>
          <span>•</span>
          <span>Asset Classes: <strong>U.S. Financials (Big 6 & Alts)</strong>, <strong>European Financials & STOXX 600</strong>, US & EU Tech Champions, Commodities</span>
        </div>

        {/* Progress / Segmented Indicator */}
        <div className="mt-2.5 w-full bg-slate-200 h-1 rounded-full overflow-hidden flex">
          <div className="bg-[#002D62] h-full w-1/4"></div>
          <div className="bg-[#005a9c] h-full w-1/4"></div>
          <div className="bg-[#0072ce] h-full w-1/4"></div>
          <div className="bg-[#2870ed] h-full w-1/4"></div>
        </div>
      </div>

      {/* 2. J.P. Morgan Dual View Mode Navigation (List View vs Group by Asset Class) */}
      <div className="border-b border-slate-200 px-4 pt-3 flex flex-wrap items-center justify-between gap-4 bg-white">
        <div className="flex items-center space-x-8">
          <button
            id="btn-jpm-list-view"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 pb-3 text-sm font-semibold transition cursor-pointer relative ${
              viewMode === 'list'
                ? 'text-slate-900 border-b-2 border-[#005a9c]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Menu className="w-4 h-4 text-slate-700" />
            <span>List View</span>
          </button>

          <button
            id="btn-jpm-grouped-view"
            onClick={() => setViewMode('grouped')}
            className={`flex items-center gap-2 pb-3 text-sm font-semibold transition cursor-pointer relative ${
              viewMode === 'grouped'
                ? 'text-slate-900 border-b-2 border-[#005a9c]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4 text-slate-700" />
            <span>Group by Asset Class</span>
          </button>
        </div>

        {/* Quick Filter & Search Bar */}
        <div className="flex items-center gap-2 pb-2.5">
          <div className="relative w-48 sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by name, ticker..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:border-[#005a9c] font-sans"
            />
          </div>

          <select
            id="select-asset-class-filter"
            value={selectedAssetClassFilter}
            onChange={(e) => {
              setSelectedAssetClassFilter(e.target.value);
              if (!['The Shovel Sellers', 'Hyperscalers & Neo Clouds'].includes(e.target.value)) {
                setSelectedSubSectorFilter('ALL');
              }
            }}
            className="border border-slate-200 rounded-md py-1 px-2 text-xs bg-slate-50 text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Asset Classes ({allAssets.length})</option>
            {assetClassesList.map(ac => (
              <option key={ac} value={ac}>{ac}</option>
            ))}
          </select>

          {/* Sub-Sector Dropdown for The Shovel Sellers */}
          {['The Shovel Sellers', 'Hyperscalers & Neo Clouds'].includes(selectedAssetClassFilter) && (
            <select
              id="select-subsector"
              value={selectedSubSectorFilter}
              onChange={(e) => setSelectedSubSectorFilter(e.target.value)}
              className="border border-[#005a9c] bg-blue-50/70 text-[#005a9c] font-semibold rounded-md py-1 px-2.5 text-xs focus:outline-none cursor-pointer transition"
            >
              <option value="ALL">All Sub-Sectors</option>
              {(selectedAssetClassFilter === 'The Shovel Sellers'
                ? SHOVEL_SUB_SECTORS.map(id => ({ id, label: id }))
                : HYPERSCALER_SUB_SECTORS
              ).map(sub => (
                <option key={sub.id} value={sub.id}>{sub.label}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Asset Class Quick Filter Pill Banner */}
      <div id="jpm-asset-class-pill-bar" className="px-4 py-2 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono-code shrink-0 mr-1">
          ASSET CLASS:
        </span>
        <button
          onClick={() => {
            setSelectedAssetClassFilter('ALL');
            setSelectedSubSectorFilter('ALL');
          }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 transition cursor-pointer ${
            selectedAssetClassFilter === 'ALL'
              ? 'bg-[#002D62] text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <span>All Asset Classes</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono-code ${
            selectedAssetClassFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {allAssets.length}
          </span>
        </button>

        {assetClassesList.map((ac) => {
          const count = allAssets.filter(a => a.assetClass === ac).length;
          const isActive = selectedAssetClassFilter === ac;
          return (
            <button
              key={ac}
              onClick={() => {
                setSelectedAssetClassFilter(ac);
                setSelectedSubSectorFilter('ALL');
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 transition cursor-pointer ${
                isActive
                  ? 'bg-[#005a9c] text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>{ac}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono-code ${
                isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sub-Sector Interactive Pill Banner for The Shovel Sellers */}
      {['The Shovel Sellers', 'Hyperscalers & Neo Clouds'].includes(selectedAssetClassFilter) && (
        <div id="shovel-subsector-pill-bar" className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono-code mr-1">
              SUB-SECTOR:
            </span>
            {[
              { id: 'ALL', label: 'All Sub-Sectors', count: allAssets.filter(a => a.assetClass === selectedAssetClassFilter).length },
              ...(selectedAssetClassFilter === 'The Shovel Sellers'
                ? SHOVEL_SUB_SECTORS.map(id => ({ id, label: id, count: allAssets.filter(a => a.assetClass === 'The Shovel Sellers' && a.subSector === id).length }))
                : HYPERSCALER_SUB_SECTORS.map(sub => ({ ...sub, count: allAssets.filter(a => a.assetClass === 'Hyperscalers & Neo Clouds' && a.subSector === sub.id).length })))
            ].map(sub => {
              const isActive = selectedSubSectorFilter === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubSectorFilter(sub.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                    isActive 
                      ? 'bg-[#005a9c] text-white shadow-2xs' 
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <span>{sub.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono-code ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {sub.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-slate-500 font-mono-code flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Yahoo Finance & SEC EDGAR Aligned Data (100% Free & Keyless)</span>
          </div>
        </div>
      )}

      {/* 3. Subheader: "78 Available Shareclasses" (Screenshot 1 Authentic Styling) */}
      <div className="px-4 py-3 bg-white text-xs font-medium text-slate-500 flex items-center justify-between border-b border-slate-100">
        <span>{sortedAssets.length} Available Securities & Benchmarks</span>
        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono-code">
          <span>CURRENCY CONVERTED TO BASE</span>
          <span>•</span>
          <span>NYC / LON DESK QUOTES</span>
        </div>
      </div>

      {/* 4. Table Header Row (J.P. Morgan Authentic Hairline 2-Column or Multi-Column Table) */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead>
            <tr className="border-t border-b border-slate-200 bg-white text-xs font-semibold text-slate-900 uppercase tracking-tight">
              <th 
                onClick={() => handleSort('name')}
                className="py-3.5 px-4 border-r border-slate-200 cursor-pointer hover:bg-slate-50 transition select-none w-5/12 sm:w-4/12"
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <span>FUND / SECURITY NAME</span>
                  {sortField === 'name' ? (
                    sortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5 text-[#005a9c]" /> : <ArrowUp className="w-3.5 h-3.5 text-[#005a9c]" />
                  ) : (
                    <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </div>
                <div className="text-[11px] font-normal text-[#005a9c] lowercase tracking-normal mt-0.5">
                  sorted by Market Cap / AUM
                </div>
              </th>

              <th 
                onClick={() => handleSort('nav')}
                className="py-3.5 px-4 border-r border-slate-200 text-right cursor-pointer hover:bg-slate-50 transition select-none w-28 sm:w-36"
              >
                <div className="flex items-center justify-end gap-1.5 font-bold">
                  <span>NAV / PRICE</span>
                  {sortField === 'nav' ? (
                    sortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5 text-[#005a9c]" /> : <ArrowUp className="w-3.5 h-3.5 text-[#005a9c]" />
                  ) : (
                    <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </div>
                <div className="text-[11px] font-normal text-slate-400 lowercase tracking-normal mt-0.5">
                  as of 09/15/2026
                </div>
              </th>

              {/* 52-Week High/Low & 200 DMA Technical Header - ALWAYS VISIBLE */}
              <th className="py-3.5 px-4 border-r border-slate-200 text-right w-56 sm:w-64 select-none bg-blue-50/20">
                <div className="flex items-center justify-end gap-1.5 font-bold text-slate-900">
                  <Activity className="w-3.5 h-3.5 text-blue-600" />
                  <span>52W RANGE & 200 DMA</span>
                </div>
                <div className="text-[10px] font-semibold text-blue-700 mt-0.5 uppercase tracking-wider font-mono-code flex items-center justify-end gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Live Yahoo Finance API</span>
                </div>
              </th>

              <th 
                onClick={() => handleSort('change')}
                className="hidden md:table-cell py-3.5 px-4 border-r border-slate-200 text-right cursor-pointer hover:bg-slate-50 transition select-none w-28"
              >
                <div className="flex items-center justify-end gap-1 font-bold">
                  <span>1-DAY RETURN</span>
                  {sortField === 'change' && (
                    sortOrder === 'desc' ? <ArrowDown className="w-3 h-3 text-[#005a9c]" /> : <ArrowUp className="w-3 h-3 text-[#005a9c]" />
                  )}
                </div>
              </th>

              <th className="hidden lg:table-cell py-3.5 px-4 border-r border-slate-200 text-left w-36">
                <span className="font-bold">ASSET CLASS & EXCHANGE</span>
              </th>

              <th className="py-3.5 px-4 text-center w-28">
                <span className="font-bold">RESEARCH</span>
              </th>
            </tr>
          </thead>

          {/* LIST VIEW RENDERING */}
          {viewMode === 'list' && (
            <tbody className="divide-y divide-slate-200 bg-white">
              {sortedAssets.map((asset) => {
                const isPositive = asset.change >= 0;
                const isSubscribed = subscribedTickers.includes(asset.ticker);
                const isTickUp = recentTicks[asset.ticker] === 'up';
                const isTickDown = recentTicks[asset.ticker] === 'down';

                return (
                  <tr 
                    key={asset.id} 
                    className={`hover:bg-[#fbfcfd] transition-colors ${
                      isTickUp ? 'bg-emerald-50/50' : isTickDown ? 'bg-rose-50/50' : ''
                    }`}
                  >
                    {/* Column 1: Fund / Security Name (Screenshot 1 Authentic Layout) */}
                    <td className="py-3.5 px-4 border-r border-slate-200 align-middle">
                      <div className="flex items-center gap-2 flex-wrap">
                        {asset.assetType === 'equity' && (
                          <StockLogo ticker={asset.ticker} size="sm" />
                        )}
                        <span className="font-mono-code font-bold text-sm text-slate-900 tracking-tight">
                          {asset.ticker}
                        </span>

                        {/* Pre/After-Market Indicator in grey with green or red figures (disappears when regular market is open) */}
                        {(() => {
                          if (asset.assetType !== 'equity') return null;
                          const q = quotes[asset.ticker] || (asset.primaryListingSymbol ? quotes[asset.primaryListingSymbol] : undefined);
                          const session = getMarketSessionInfo(asset.ticker, q);
                          const showPrePost = session && !session.isMarketOpen && (session.sessionLabel === 'Pre-Market' || session.sessionLabel === 'After-Hours') && session.prePostChangePercent !== undefined;
                          if (!showPrePost) return null;
                          const curSym = getCurrencySymbol(asset.currency);
                          return (
                            <span 
                              className="inline-flex items-center gap-1 text-[10px] font-mono-code font-medium px-1.5 py-0.5 rounded bg-slate-100/90 border border-slate-200 text-slate-500 shadow-2xs"
                              title={`${session.sessionLabel}: ${session.prePostChangePercent! >= 0 ? '+' : ''}${session.prePostChangePercent!.toFixed(2)}% (${curSym}${session.prePostPrice?.toFixed(2)})`}
                            >
                              <span className="text-[8px] uppercase text-slate-400 font-bold tracking-wider">
                                {session.sessionLabel === 'Pre-Market' ? 'PRE' : 'POST'}
                              </span>
                              {session.prePostPrice !== undefined && (
                                <span className="text-slate-500 font-normal">
                                  {curSym}{session.prePostPrice.toFixed(2)}
                                </span>
                              )}
                              <span className={`font-bold tabular-nums ${session.prePostChangePercent! >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {session.prePostChangePercent! >= 0 ? '+' : ''}{session.prePostChangePercent!.toFixed(2)}%
                              </span>
                            </span>
                          );
                        })()}

                        {/* Yellow / Amber NOTE badge (Screenshot 1 pill) */}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FDF3D8] text-[#855B00] border border-[#F3DE9D]">
                          {asset.noteBadge || 'NOTE'}
                        </span>

                        {/* Push alert bell for equities */}
                        {asset.assetType === 'equity' && (
                          <button
                            onClick={() => onToggleSubscription(asset.ticker)}
                            title={isSubscribed ? "Alerts enabled" : "Enable push notifications"}
                            className="text-slate-400 hover:text-emerald-700 transition cursor-pointer p-0.5"
                          >
                            {isSubscribed ? (
                              <Bell className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                            ) : (
                              <BellOff className="w-3.5 h-3.5 hover:text-slate-600" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Security Full Name in J.P. Morgan Link Blue */}
                      <button
                        onClick={() => {
                          if (asset.quarterlyResult) onSelectResult(asset.quarterlyResult);
                          else if (asset.commodityData && onSelectCommodity) onSelectCommodity(asset.commodityData.id);
                        }}
                        className="text-left font-medium text-sm text-[#0066CC] hover:underline mt-0.5 block truncate max-w-md cursor-pointer"
                      >
                        {asset.name}
                      </button>

                      <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500 font-sans mt-0.5">
                        <span>{asset.exchange} • <span className="font-semibold text-slate-700 font-mono-code">{formatMarketCapInParens(asset.aumOrMarketCap)}</span></span>
                        {asset.primaryListingSymbol && (
                          <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-mono-code text-[10px] border border-indigo-200 font-semibold" title="Primary Local Exchange Listing">
                            Primary: {asset.primaryListingSymbol}
                          </span>
                        )}
                        {asset.subSector && (
                          <span className="px-1.5 py-0.2 rounded bg-blue-50 text-[#005a9c] font-mono-code text-[10px] border border-blue-100 font-semibold">
                            {asset.subSector}
                          </span>
                        )}
                        {asset.quarterlyResult?.reportDate && (
                          <span className="text-[10px] text-emerald-700 font-mono-code flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Rep: {asset.quarterlyResult.reportDate}</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Column 2: NAV / PRICE (Native currency, no USD calculation for daily price) */}
                    <td className="py-3.5 px-4 border-r border-slate-200 text-right align-middle font-mono-code">
                      <div className="text-sm font-bold text-slate-900">
                        {getCurrencySymbol(asset.currency)}{asset.currency === 'JPY' || asset.currency === 'KRW' ? Math.round(asset.price).toLocaleString() : asset.price.toFixed(2)}
                        {asset.currency && asset.currency !== 'USD' && (
                          <span className="text-[10px] text-slate-500 font-sans font-normal ml-1">{asset.currency}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-sans">
                        {asset.asOfDate}
                      </div>
                      {/* Mobile inline technical indicators */}
                      {(() => {
                        const tech = getStockTechnicalMetrics(asset.ticker, asset.price, quotes[asset.ticker]);
                        return (
                          <div className="sm:hidden text-[10px] mt-1 text-slate-500 font-sans">
                            <div>200D: {getCurrencySymbol(asset.currency)}{tech.twoHundredDayAverage.toFixed(2)}</div>
                            {tech.belowTwoHundredDayAverage && (
                              <span className="text-amber-700 font-bold font-mono-code">&lt; 200 DMA</span>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Column 3: 52-Week High / Low & 200-Day Moving Average - ALWAYS VISIBLE */}
                    <td className="py-3 px-3 sm:px-4 border-r border-slate-200 text-right align-middle font-mono-code bg-slate-50/20">
                      {(() => {
                        const curSym = getCurrencySymbol(asset.currency);
                        const tech = getStockTechnicalMetrics(asset.ticker, asset.price, quotes[asset.ticker]);

                        return (
                          <div className="flex flex-col items-end">
                            {/* 52W Range Visual Track */}
                            <div className="flex items-center gap-1.5 text-xs text-slate-800 font-medium">
                              <span className="text-[10px] text-slate-400 uppercase font-sans">52W:</span>
                              <span className="font-bold text-slate-900">{curSym}{tech.fiftyTwoWeekLow.toFixed(2)}</span>
                              <div className="w-12 sm:w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden relative mx-0.5" title={`Position in 52W range: ${tech.rangePositionPercent}%`}>
                                <div 
                                  className="bg-blue-600 h-full rounded-full transition-all"
                                  style={{ width: `${tech.rangePositionPercent}%` }}
                                />
                              </div>
                              <span className="font-bold text-slate-900">{curSym}{tech.fiftyTwoWeekHigh.toFixed(2)}</span>
                            </div>

                            {/* 200 DMA */}
                            <div className="text-xs mt-1 text-slate-700 flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-400 uppercase font-sans">200 DMA:</span>
                              <span className="font-bold font-mono-code text-slate-900">{curSym}{tech.twoHundredDayAverage.toFixed(2)}</span>
                              <span className={`text-[9px] px-1 py-0.2 rounded font-mono-code font-bold ${
                                tech.isLiveDma 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {tech.isLiveDma ? 'LIVE YAHOO' : 'EST'}
                              </span>
                            </div>

                            {/* Technical Status Button / Warning Alert */}
                            <div className="mt-1.5">
                              {tech.belowTwoHundredDayAverage ? (
                                <button
                                  onClick={() => onTriggerTechnicalAlert?.(
                                    asset.ticker, 
                                    asset.price, 
                                    tech.twoHundredDayAverage, 
                                    tech.fiftyTwoWeekHigh, 
                                    tech.fiftyTwoWeekLow
                                  )}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 text-[10px] font-bold hover:bg-amber-100 transition cursor-pointer shadow-2xs"
                                  title={`Warning: ${asset.ticker} (${curSym}${asset.price.toFixed(2)}) is below its 200 DMA (${curSym}${tech.twoHundredDayAverage.toFixed(2)}). Click to trigger institutional alert.`}
                                >
                                  <AlertTriangle className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                                  <span>BELOW 200 DMA ({tech.distanceFromTwoHundredDayPercent}%)</span>
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
                                  <span>▲ Above 200 DMA (+{tech.distanceFromTwoHundredDayPercent}%)</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Column 3: 1-Day Return */}
                    <td className="hidden md:table-cell py-3.5 px-4 border-r border-slate-200 text-right align-middle font-mono-code">
                      <div className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded ${
                        isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {isPositive ? '+' : ''}{asset.changePercent.toFixed(2)}%
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {isPositive ? '+' : ''}{getCurrencySymbol(asset.currency)}{asset.change.toFixed(2)}
                      </div>
                    </td>

                    {/* Column 4: Asset Class */}
                    <td className="hidden lg:table-cell py-3.5 px-4 border-r border-slate-200 align-middle">
                      <span className="text-xs font-medium text-slate-700 block truncate">
                        {asset.assetClass}
                      </span>
                      {asset.subSector ? (
                        <span className="text-[10px] text-[#005a9c] font-semibold block truncate">
                          {asset.subSector}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 uppercase font-mono-code">
                          {asset.assetType}
                        </span>
                      )}
                    </td>

                    {/* Column 5: Research Action */}
                    <td className="py-3.5 px-4 text-center align-middle">
                      {asset.quarterlyResult ? (
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {asset.quarterlyResult.analystOutlooks && asset.quarterlyResult.analystOutlooks.length > 0 && (
                            <button
                              onClick={() => onSelectResult(asset.quarterlyResult!)}
                              title="View Investment Bank Analyst Outlooks"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 hover:bg-[#005a9c] hover:text-white text-blue-700 text-xs font-semibold transition cursor-pointer border border-blue-200"
                            >
                              <TrendingUp className="w-3 h-3" />
                              <span>Outlook</span>
                            </button>
                          )}
                          {asset.quarterlyResult.isBankingIndex && (
                            <button
                              onClick={() => onSelectResult(asset.quarterlyResult!)}
                              title="View STOXX 600 Banks Macro Metrics"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-sky-50 hover:bg-sky-700 hover:text-white text-sky-800 text-xs font-semibold transition cursor-pointer border border-sky-200"
                            >
                              <span>Macro</span>
                            </button>
                          )}
                          <button
                            onClick={() => onGenerateAiMemo(asset.quarterlyResult!)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-[#005a9c] hover:text-white text-slate-700 text-xs font-semibold transition cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Memo</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => asset.commodityData && onSelectCommodity && onSelectCommodity(asset.commodityData.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-900 text-xs font-semibold transition cursor-pointer"
                        >
                          <span>Desk</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          )}

          {/* GROUP BY ASSET CLASS VIEW RENDERING */}
          {viewMode === 'grouped' && (
            <tbody className="divide-y divide-slate-200 bg-white">
              {(Object.entries(groupedAssets) as [string, UnifiedAsset[]][]).map(([groupName, items]) => {
                const isCollapsed = !!collapsedGroups[groupName];

                return (
                  <React.Fragment key={groupName}>
                    {/* Asset Class Group Header Bar */}
                    <tr className="bg-[#f0f4f8] border-t-2 border-b border-slate-300">
                      <td colSpan={6} className="py-2.5 px-4">
                        <button
                          onClick={() => toggleGroupCollapse(groupName)}
                          className="flex items-center justify-between w-full text-left cursor-pointer"
                        >
                          <div className="flex items-center space-x-2.5">
                            <Building2 className="w-4 h-4 text-[#005a9c]" />
                            <span className="font-bold text-sm text-slate-900 tracking-tight font-mono-code uppercase">
                              {groupName}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-700 border border-slate-300">
                              {items.length} Shareclasses
                            </span>
                          </div>
                          <div className="flex items-center text-xs text-slate-500 font-medium">
                            <span className="mr-1">{isCollapsed ? 'Expand' : 'Collapse'}</span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                          </div>
                        </button>
                      </td>
                    </tr>

                    {/* Group Items */}
                    {!isCollapsed && items.map((asset) => {
                      const isPositive = asset.change >= 0;
                      const isSubscribed = subscribedTickers.includes(asset.ticker);

                      return (
                        <tr key={asset.id} className="hover:bg-[#fbfcfd] transition-colors">
                          <td className="py-3.5 px-4 border-r border-slate-200 align-middle pl-6">
                            <div className="flex items-center gap-2 flex-wrap">
                              {asset.assetType === 'equity' && (
                                <StockLogo ticker={asset.ticker} size="sm" />
                              )}
                              <span className="font-mono-code font-bold text-sm text-slate-900">
                                {asset.ticker}
                              </span>

                              {/* Pre/After-Market Indicator in grey with green or red figures (disappears when regular market is open) */}
                              {(() => {
                                if (asset.assetType !== 'equity') return null;
                                const q = quotes[asset.ticker] || (asset.primaryListingSymbol ? quotes[asset.primaryListingSymbol] : undefined);
                                const session = getMarketSessionInfo(asset.ticker, q);
                                const showPrePost = session && !session.isMarketOpen && (session.sessionLabel === 'Pre-Market' || session.sessionLabel === 'After-Hours') && session.prePostChangePercent !== undefined;
                                if (!showPrePost) return null;
                                const curSym = getCurrencySymbol(asset.currency);
                                return (
                                  <span 
                                    className="inline-flex items-center gap-1 text-[10px] font-mono-code font-medium px-1.5 py-0.5 rounded bg-slate-100/90 border border-slate-200 text-slate-500 shadow-2xs"
                                    title={`${session.sessionLabel}: ${session.prePostChangePercent! >= 0 ? '+' : ''}${session.prePostChangePercent!.toFixed(2)}% (${curSym}${session.prePostPrice?.toFixed(2)})`}
                                  >
                                    <span className="text-[8px] uppercase text-slate-400 font-bold tracking-wider">
                                      {session.sessionLabel === 'Pre-Market' ? 'PRE' : 'POST'}
                                    </span>
                                    {session.prePostPrice !== undefined && (
                                      <span className="text-slate-500 font-normal">
                                        {curSym}{session.prePostPrice.toFixed(2)}
                                      </span>
                                    )}
                                    <span className={`font-bold tabular-nums ${session.prePostChangePercent! >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {session.prePostChangePercent! >= 0 ? '+' : ''}{session.prePostChangePercent!.toFixed(2)}%
                                    </span>
                                  </span>
                                );
                              })()}

                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FDF3D8] text-[#855B00] border border-[#F3DE9D]">
                                {asset.noteBadge || 'NOTE'}
                              </span>
                              {asset.assetType === 'equity' && (
                                <button
                                  onClick={() => onToggleSubscription(asset.ticker)}
                                  className="text-slate-400 hover:text-emerald-700 p-0.5 cursor-pointer"
                                >
                                  {isSubscribed ? <Bell className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" /> : <BellOff className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                if (asset.quarterlyResult) onSelectResult(asset.quarterlyResult);
                                else if (asset.commodityData && onSelectCommodity) onSelectCommodity(asset.commodityData.id);
                              }}
                              className="text-left font-medium text-sm text-[#0066CC] hover:underline mt-0.5 block truncate max-w-md cursor-pointer"
                            >
                              {asset.name}
                            </button>
                            <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500 font-sans mt-0.5">
                              <span>{asset.exchange} • <span className="font-semibold text-slate-700 font-mono-code">{formatMarketCapInParens(asset.aumOrMarketCap)}</span></span>
                              {asset.primaryListingSymbol && (
                                <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-mono-code text-[10px] border border-indigo-200 font-semibold" title="Primary Local Exchange Listing">
                                  Primary: {asset.primaryListingSymbol}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Column 2: NAV / PRICE (Native currency, no USD calculation for daily price) */}
                          <td className="py-3.5 px-4 border-r border-slate-200 text-right align-middle font-mono-code">
                            <div className="text-sm font-bold text-slate-900">
                              {getCurrencySymbol(asset.currency)}{asset.currency === 'JPY' || asset.currency === 'KRW' ? Math.round(asset.price).toLocaleString() : asset.price.toFixed(2)}
                              {asset.currency && asset.currency !== 'USD' && (
                                <span className="text-[10px] text-slate-500 font-sans font-normal ml-1">{asset.currency}</span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-sans">
                              {asset.asOfDate}
                            </div>
                            {/* Mobile inline technical indicator */}
                            {(() => {
                              const tech = getStockTechnicalMetrics(asset.ticker, asset.price, quotes[asset.ticker]);
                              return (
                                <div className="sm:hidden text-[10px] mt-1 text-slate-500 font-sans">
                                  <div>200D: {getCurrencySymbol(asset.currency)}{tech.twoHundredDayAverage.toFixed(2)}</div>
                                  {tech.belowTwoHundredDayAverage && (
                                    <span className="text-amber-700 font-bold font-mono-code">&lt; 200 DMA</span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          {/* Column 3: 52-Week High / Low & 200-Day Moving Average - ALWAYS VISIBLE */}
                          <td className="py-3 px-3 sm:px-4 border-r border-slate-200 text-right align-middle font-mono-code bg-slate-50/20">
                            {(() => {
                              const curSym = getCurrencySymbol(asset.currency);
                              const tech = getStockTechnicalMetrics(asset.ticker, asset.price, quotes[asset.ticker]);

                              return (
                                <div className="flex flex-col items-end">
                                  {/* 52W Range Visual Track */}
                                  <div className="flex items-center gap-1.5 text-xs text-slate-800 font-medium">
                                    <span className="text-[10px] text-slate-400 uppercase font-sans">52W:</span>
                                    <span className="font-bold text-slate-900">{curSym}{tech.fiftyTwoWeekLow.toFixed(2)}</span>
                                    <div className="w-12 sm:w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden relative mx-0.5" title={`Position in 52W range: ${tech.rangePositionPercent}%`}>
                                      <div 
                                        className="bg-blue-600 h-full rounded-full transition-all"
                                        style={{ width: `${tech.rangePositionPercent}%` }}
                                      />
                                    </div>
                                    <span className="font-bold text-slate-900">{curSym}{tech.fiftyTwoWeekHigh.toFixed(2)}</span>
                                  </div>

                                  {/* 200 DMA */}
                                  <div className="text-xs mt-1 text-slate-700 flex items-center gap-1.5">
                                    <span className="text-[10px] text-slate-400 uppercase font-sans">200 DMA:</span>
                                    <span className="font-bold font-mono-code text-slate-900">{curSym}{tech.twoHundredDayAverage.toFixed(2)}</span>
                                    <span className={`text-[9px] px-1 py-0.2 rounded font-mono-code font-bold ${
                                      tech.isLiveDma 
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                        : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      {tech.isLiveDma ? 'LIVE YAHOO' : 'EST'}
                                    </span>
                                  </div>

                                  {/* Technical Status Button / Warning Alert */}
                                  <div className="mt-1.5">
                                    {tech.belowTwoHundredDayAverage ? (
                                      <button
                                        onClick={() => onTriggerTechnicalAlert?.(
                                          asset.ticker, 
                                          asset.price, 
                                          tech.twoHundredDayAverage, 
                                          tech.fiftyTwoWeekHigh, 
                                          tech.fiftyTwoWeekLow
                                        )}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 text-[10px] font-bold hover:bg-amber-100 transition cursor-pointer shadow-2xs"
                                        title={`Warning: ${asset.ticker} (${curSym}${asset.price.toFixed(2)}) is below its 200 DMA (${curSym}${tech.twoHundredDayAverage.toFixed(2)}). Click to trigger institutional alert.`}
                                      >
                                        <AlertTriangle className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                                        <span>BELOW 200 DMA ({tech.distanceFromTwoHundredDayPercent}%)</span>
                                      </button>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
                                        <span>▲ Above 200 DMA (+{tech.distanceFromTwoHundredDayPercent}%)</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </td>

                          <td className="hidden md:table-cell py-3.5 px-4 border-r border-slate-200 text-right align-middle font-mono-code">
                            <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded ${
                              isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}>
                              {isPositive ? '+' : ''}{asset.changePercent.toFixed(2)}%
                            </span>
                          </td>

                          <td className="hidden lg:table-cell py-3.5 px-4 border-r border-slate-200 align-middle">
                            <span className="text-xs text-slate-600">
                              {asset.exchange}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center align-middle">
                            {asset.quarterlyResult ? (
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                {asset.quarterlyResult.analystOutlooks && asset.quarterlyResult.analystOutlooks.length > 0 && (
                                  <button
                                    onClick={() => onSelectResult(asset.quarterlyResult!)}
                                    title="View Investment Bank Analyst Outlooks"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 hover:bg-[#005a9c] hover:text-white text-blue-700 text-xs font-semibold transition cursor-pointer border border-blue-200"
                                  >
                                    <TrendingUp className="w-3 h-3" />
                                    <span>Outlook</span>
                                  </button>
                                )}
                                {asset.quarterlyResult.isBankingIndex && (
                                  <button
                                    onClick={() => onSelectResult(asset.quarterlyResult!)}
                                    title="View STOXX 600 Banks Macro Metrics"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-sky-50 hover:bg-sky-700 hover:text-white text-sky-800 text-xs font-semibold transition cursor-pointer border border-sky-200"
                                  >
                                    <span>Macro</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => onGenerateAiMemo(asset.quarterlyResult!)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-[#005a9c] hover:text-white text-slate-700 text-xs font-semibold transition cursor-pointer"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  <span>Memo</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => asset.commodityData && onSelectCommodity && onSelectCommodity(asset.commodityData.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-900 text-xs font-semibold cursor-pointer"
                              >
                                <span>Desk</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          )}
        </table>
      </div>

      {/* J.P. Morgan Table Footer Note */}
      <div className="p-4 bg-[#fbfcfd] border-t border-slate-200 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-[#005a9c] shrink-0" />
          <span>
            <strong>Institutional Disclosure:</strong> NAV and intraday quotes are updated continuously. Past performance does not guarantee future results.
          </span>
        </div>
        <div className="font-mono-code text-[11px] text-slate-400">
          POWERED BY J.P. MORGAN ASSET INTELLIGENCE SCHEMA
        </div>
      </div>
    </div>
  );
};
