import { CompanyMeta, QuarterlyResult } from '../types';

export const AEROSPACE_DEFENSE_SUB_SECTORS = [
  'Defense Contractors',
  'Aircraft Manufacturers',
  'Drone Industry',
  'Commercial Aerospace & Satellite'
] as const;

export type AerospaceDefenseSubSector = typeof AEROSPACE_DEFENSE_SUB_SECTORS[number];

export const AEROSPACE_DEFENSE_TICKERS = [
  'SPCX','GE','RTX','BA','LMT','RKLB','DRS','RKGRY','RCAT','RYCEY',
  'EADSY','RNMBY','BDRBF','KTOS','AVAV','ESLT','UMAC','DRO','ASTS','RDW'
] as const;

type AerospaceCompanyDefinition = CompanyMeta & {
  subSector: AerospaceDefenseSubSector;
  yahooTicker?: string;
};

const makeMeta = (
  ticker: string,
  name: string,
  subSector: AerospaceDefenseSubSector,
  country: string,
  exchange: string,
  currency: string,
  description: string
): AerospaceCompanyDefinition => ({
  ticker,
  name,
  sector: 'Aerospace & Defense',
  subSector,
  region: country === 'United States' ? 'US' : 'Europe',
  country,
  exchange,
  logoBg: 'bg-slate-900',
  logoTextColor: 'text-slate-200',
  marketCap: 'Live Yahoo Finance',
  currentPrice: 0,
  dayChangePercent: 0,
  description,
  currency
});

export const AEROSPACE_DEFENSE_COMPANIES: Record<string, AerospaceCompanyDefinition> = {
  SPCX: makeMeta('SPCX','Space Exploration Technologies Corp.','Commercial Aerospace & Satellite','United States','NASDAQ','USD','Space launch, satellite connectivity and space systems company. Public trading began in June 2026, so historical market/financial depth is intentionally limited to the available reporting period.'),
  GE: makeMeta('GE','GE Aerospace','Commercial Aerospace & Satellite','United States','NYSE','USD','Aerospace engine, propulsion, systems and aftermarket services provider across commercial and defense aviation.'),
  RTX: makeMeta('RTX','RTX Corporation','Defense Contractors','United States','NYSE','USD','Aerospace and defense systems company spanning Raytheon, Collins Aerospace and Pratt & Whitney.'),
  BA: makeMeta('BA','The Boeing Company','Aircraft Manufacturers','United States','NYSE','USD','Commercial airplanes, defense aircraft and space systems manufacturer.'),
  LMT: makeMeta('LMT','Lockheed Martin Corporation','Defense Contractors','United States','NYSE','USD','Defense technology company spanning aeronautics, missiles and fire control, rotary and mission systems, and space.'),
  RKLB: makeMeta('RKLB','Rocket Lab Corporation','Commercial Aerospace & Satellite','United States','NASDAQ','USD','Launch services and space systems company serving commercial, aerospace-prime and government customers.'),
  DRS: makeMeta('DRS','Leonardo DRS, Inc.','Defense Contractors','United States','NASDAQ','USD','Defense electronics, sensing, computing, power and military support systems provider.'),
  RKGRY: makeMeta('RKGRY','Rheinmetall AG','Defense Contractors','Germany','OTC / Xetra primary listing','USD','European defense systems and military technology company.'),
  RCAT: makeMeta('RCAT','Red Cat Holdings, Inc.','Drone Industry','United States','NASDAQ','USD','Drone and robotic systems company focused on defense, national security and commercial applications.'),
  RYCEY: makeMeta('RYCEY','Rolls-Royce Holdings plc','Commercial Aerospace & Satellite','United Kingdom','OTC / London primary listing','USD','Civil aerospace engines and aftermarket services, alongside defense and power systems.'),
  EADSY: makeMeta('EADSY','Airbus SE','Aircraft Manufacturers','Netherlands','OTC / Euronext primary listing','USD','Aircraft, aerospace and related services manufacturer with commercial aviation, defense and space activities.'),
  RNMBY: makeMeta('RNMBY','Rheinmetall AG','Defense Contractors','Germany','OTC / Xetra primary listing','USD','European defense systems and military technology company; RNMBY is an OTC ADR representation.'),
  BDRBF: makeMeta('BDRBF','Bombardier Inc.','Aircraft Manufacturers','Canada','OTC / Toronto primary listing','USD','Business aircraft manufacturer and aviation services company.'),
  KTOS: makeMeta('KTOS','Kratos Defense & Security Solutions, Inc.','Defense Contractors','United States','NASDAQ','USD','Defense and national-security technology company focused on unmanned systems, propulsion, space and missile-defense technologies.'),
  AVAV: makeMeta('AVAV','AeroVironment, Inc.','Drone Industry','United States','NASDAQ','USD','Uncrewed aircraft, counter-UAS, autonomy, space and directed-energy defense technology provider.'),
  ESLT: makeMeta('ESLT','Elbit Systems Ltd.','Defense Contractors','Israel','NASDAQ / Tel Aviv primary listing','USD','Defense electronics, unmanned systems, electro-optics, C4I, cyber, land and aerospace systems provider.'),
  UMAC: makeMeta('UMAC','Unusual Machines, Inc.','Drone Industry','United States','NYSE American','USD','Commercial drone company supplying small drones and critical drone components.'),
  DRO: makeMeta('DRO','DroneShield Limited','Drone Industry','Australia','ASX / OTC representation','USD','Counter-drone technology company providing detection, electronic warfare and defeat systems for unmanned aircraft.'),
  ASTS: makeMeta('ASTS','AST SpaceMobile, Inc.','Commercial Aerospace & Satellite','United States','NASDAQ','USD','Satellite communications company building direct-to-device cellular broadband connectivity from low-Earth orbit.'),
  RDW: makeMeta('RDW','Redwire Corporation','Commercial Aerospace & Satellite','United States','NYSE','USD','Space infrastructure company supplying spacecraft platforms, components, in-space manufacturing and mission systems.')
};

export const AEROSPACE_DEFENSE_RESULTS: QuarterlyResult[] = AEROSPACE_DEFENSE_TICKERS.map(ticker => {
  const meta = AEROSPACE_DEFENSE_COMPANIES[ticker];
  return {
    id: `aero-defense-${ticker.toLowerCase()}`,
    ticker,
    companyName: meta.name,
    sector: 'Aerospace & Defense',
    region: meta.region,
    country: meta.country,
    quarter: 'Live Yahoo Finance',
    fiscalYear: 2026,
    // Placeholder is immediately replaced by the live Yahoo/SEC earnings-calendar feed.
    // It is deliberately not presented as a verified earnings date or estimate.
    reportDate: '1970-01-01',
    status: 'upcoming',
    currency: meta.currency,
    epsEstimate: 0,
    revenueEstimate: 0,
    keyHighlights: ['Live earnings calendar and analyst consensus are loaded from Yahoo Finance when available.'],
    guidanceRating: 'pending',
    guidanceSummary: 'Awaiting live provider data; no synthetic earnings figures are used.',
    isImportant: false,
    subSector: meta.subSector,
    liveDateProvider: 'Pending Yahoo Finance live feed',
    isDateConfirmed: false
  };
});
