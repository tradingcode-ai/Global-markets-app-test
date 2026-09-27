import { LiveQuote } from '../types';

export interface LiveEarningsDateData {
  symbol: string;
  reportDate?: string;
  reportTime?: 'BMO' | 'AMC';
  isConfirmed?: boolean;
  provider?: string;
  epsEstimate?: number;
  revenueEstimate?: number;
}

export async function fetchLiveMarketQuotes(symbols?: string[]): Promise<Record<string, LiveQuote>> {
  try {
    const url = symbols && symbols.length > 0
      ? `/api/market-quotes?symbols=${encodeURIComponent(symbols.join(','))}`
      : '/api/market-quotes';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    return json.quotes || {};
  } catch (err) {
    console.warn('Failed to fetch live market quotes:', err);
    return {};
  }
}

export async function fetchLiveEarningsCalendar(symbols?: string[]): Promise<Record<string, LiveEarningsDateData>> {
  try {
    const url = symbols && symbols.length > 0
      ? `/api/earnings-calendar?symbols=${encodeURIComponent(symbols.join(','))}`
      : '/api/earnings-calendar';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    return json.calendar || {};
  } catch (err) {
    console.warn('Failed to fetch live earnings calendar:', err);
    return {};
  }
}

export async function fetchQuarterlyAnalystOutlook(symbols?: string[]): Promise<{ data: Record<string, any>; provider?: string }> {
  try {
    const url = symbols && symbols.length > 0
      ? `/api/quarterly-analyst-outlook?symbols=${encodeURIComponent(symbols.join(','))}`
      : '/api/quarterly-analyst-outlook';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    return {
      data: json.data || {},
      provider: json.provider
    };
  } catch (err) {
    console.warn('Failed to fetch quarterly analyst outlook:', err);
    return { data: {} };
  }
}

const ANALYST_SNAPSHOT_STORAGE_KEY = 'global-markets-analyst-snapshots-v1';

export function getStoredAnalystSnapshots(): Record<string, any> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(ANALYST_SNAPSHOT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveAnalystSnapshots(snapshots: Record<string, any>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ANALYST_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshots));
  } catch {
    // Ignore unavailable/full browser storage.
  }
}

export function mergeAnalystSnapshots(
  live: Record<string, any>,
  stored: Record<string, any>
): Record<string, any> {
  const merged: Record<string, any> = { ...stored };
  for (const [ticker, snapshot] of Object.entries(live || {})) {
    if (!snapshot || snapshot.isLiveFeed !== true) continue;
    merged[ticker] = {
      ...snapshot,
      snapshotSavedAt: new Date().toISOString(),
      dataSource: 'Yahoo Finance',
      isCachedSnapshot: false
    };
  }
  return merged;
}
