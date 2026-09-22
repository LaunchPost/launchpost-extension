/**
 * Quote assets a coin can be paired with on pons (Robinhood Chain). Default is ETH. The rest are pons-approved
 * ERC-20s: Robinhood's tokenised stocks and ETFs, USDG, cbBTC, TAO. Buyers pay in the pair asset, graduation is
 * counted in it, the pool is paired against it, and the creator is paid in it.
 *
 * Table mirrors pons' own create flow (Sep 2026). The engine re-checks `approvedPairTokens` on-chain before launch.
 */
export interface PairAsset {
  symbol: string;
  name: string;
  /** Zero address = native ETH. */
  address: `0x${string}`;
  decimals: number;
  cls: "native" | "stablecoin" | "crypto" | "equity";
}

export const ETH_PAIR: PairAsset = { symbol: "ETH", name: "Ether", address: "0x0000000000000000000000000000000000000000", decimals: 18, cls: "native" };

export const PAIRS: PairAsset[] = [
  ETH_PAIR,
  { symbol: "USDG", name: "Global Dollar", address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", decimals: 6, cls: "stablecoin" },
  { symbol: "cbBTC", name: "Coinbase Wrapped BTC", address: "0xCEC185eB182c47d1bA1EFc84e6959e18cd620Be4", decimals: 8, cls: "crypto" },
  { symbol: "TAO", name: "Bittensor", address: "0xf3081494B87e8D5fb7960f066E931D1D0e6E3d67", decimals: 18, cls: "crypto" },
  // ---- tokenised equities / ETFs
  { symbol: "AAPL", name: "Apple", address: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9", decimals: 18, cls: "equity" },
  { symbol: "AMC", name: "AMC Entertainment", address: "0x05a3d1Cd21d0C88145E82600E62e7E496e0F222B", decimals: 18, cls: "equity" },
  { symbol: "AMD", name: "Advanced Micro Devices", address: "0x86923f96303D656E4aa86D9d42D1e57ad2023fdC", decimals: 18, cls: "equity" },
  { symbol: "AMZN", name: "Amazon", address: "0x12f190a9F9d7D37a250758b26824B97CE941bF54", decimals: 18, cls: "equity" },
  { symbol: "BA", name: "Boeing", address: "0x4D21483a44Bf67a86b77E3dA301411880797D452", decimals: 18, cls: "equity" },
  { symbol: "BABA", name: "Alibaba", address: "0xad25Ac6C84D497db898fa1E8387bf6Af3532a1c4", decimals: 18, cls: "equity" },
  { symbol: "BB", name: "BlackBerry", address: "0x48E39E56aCdbA37b09020C0b734A613C9a2f100A", decimals: 18, cls: "equity" },
  { symbol: "BE", name: "Bloom Energy", address: "0x822CC93fFD030293E9842c30BBD678F530701867", decimals: 18, cls: "equity" },
  { symbol: "BULL", name: "Webull", address: "0xceF9027c7d6985b85f0BA431125073529A947A68", decimals: 18, cls: "equity" },
  { symbol: "CEG", name: "Constellation Energy", address: "0xaE517A2903E68bd929Dfd15be875F8369D53e94a", decimals: 18, cls: "equity" },
  { symbol: "COIN", name: "Coinbase", address: "0x6330D8C3178a418788dF01a47479c0ce7CCF450b", decimals: 18, cls: "equity" },
  { symbol: "COST", name: "Costco", address: "0x4EA005168D7F09a7A0Ba9D1DEf21a479950E44C2", decimals: 18, cls: "equity" },
  { symbol: "CRCL", name: "Circle Internet Group", address: "0xdF0992E440dD0be65BD8439b609d6D4366bf1CB5", decimals: 18, cls: "equity" },
  { symbol: "DELL", name: "Dell Technologies", address: "0x941AE714EC6D8130c7B75d67160Ca08f1e7d11Dd", decimals: 18, cls: "equity" },
  { symbol: "DJT", name: "Trump Media & Technology Group", address: "0x1D11f0496982706C5e14A514D4E79F2e6BdE4516", decimals: 18, cls: "equity" },
  { symbol: "EWY", name: "iShares MSCI South Korea ETF", address: "0x7f0aBeF0C07280F82c6a08ead09dEd6BAE2C13Fc", decimals: 18, cls: "equity" },
  { symbol: "F", name: "Ford Motor", address: "0x25C288E6D899b9BC30160965aD9644c67e73bE0C", decimals: 18, cls: "equity" },
  { symbol: "FIG", name: "Figma", address: "0x41F4267525a8AFf329540eF24fD83d9044758B33", decimals: 18, cls: "equity" },
  { symbol: "GLD", name: "SPDR Gold Shares", address: "0xC9a981FEE1F9DEc688bb123ccDeCc63D0deBFC4e", decimals: 18, cls: "equity" },
  { symbol: "GME", name: "GameStop", address: "0x1b0E319c6A659F002271B69dB8A7df2F911c153E", decimals: 18, cls: "equity" },
  { symbol: "GOOGL", name: "Alphabet Class A", address: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3", decimals: 18, cls: "equity" },
  { symbol: "HIMS", name: "Hims & Hers Health", address: "0xCceE82fE024c36fA15E1005edE3E9e4787e23D09", decimals: 18, cls: "equity" },
  { symbol: "IBM", name: "IBM", address: "0x980dcf6766FA79f5Cf0c4AAdb3ab477ff15a9619", decimals: 18, cls: "equity" },
  { symbol: "INDA", name: "iShares MSCI India ETF", address: "0xACEF2e09adb47aD6aBeBAD9fF06689E60615C2B6", decimals: 18, cls: "equity" },
  { symbol: "INTC", name: "Intel", address: "0xc72b96e0E48ecd4DC75E1e45396e26300BC39681", decimals: 18, cls: "equity" },
  { symbol: "JNJ", name: "Johnson & Johnson", address: "0x03DfbBE0AC4E7bCDaFd08eD41A400326B77D8c80", decimals: 18, cls: "equity" },
  { symbol: "LLY", name: "Eli Lilly", address: "0x8005d266423c7ea827372c9c864491e5786600ea", decimals: 18, cls: "equity" },
  { symbol: "LMT", name: "Lockheed Martin", address: "0x329fcACEb9AD6F9580DD5F643fed0646900D043c", decimals: 18, cls: "equity" },
  { symbol: "LULU", name: "Lululemon Athletica", address: "0x4e62068525Ab11FE768e29dfD00ef909B9803016", decimals: 18, cls: "equity" },
  { symbol: "META", name: "Meta Platforms", address: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35", decimals: 18, cls: "equity" },
  { symbol: "MRNA", name: "Moderna", address: "0x43B07D15cE533bEc5476d70C22a78a1B2B662155", decimals: 18, cls: "equity" },
  { symbol: "MRVL", name: "Marvell Technology", address: "0x62fd0668e10D8B72339BE2DCF7643001688ff13B", decimals: 18, cls: "equity" },
  { symbol: "MSFT", name: "Microsoft", address: "0xe93237C50D904957Cf27E7B1133b510C669c2e74", decimals: 18, cls: "equity" },
  { symbol: "MSTR", name: "Strategy", address: "0xec262a75e413fAfD0dF80480274532C79D42da09", decimals: 18, cls: "equity" },
  { symbol: "MU", name: "Micron Technology", address: "0xfF080c8ce2E5feadaCa0Da81314Ae59D232d4afD", decimals: 18, cls: "equity" },
  { symbol: "NET", name: "Cloudflare", address: "0x116F00968269B7bfbaD4109cE591d6E74c0601d4", decimals: 18, cls: "equity" },
  { symbol: "NFLX", name: "Netflix", address: "0xE0444EF8BF4eD74f74FD73686e2ddF4C1c5591E8", decimals: 18, cls: "equity" },
  { symbol: "NU", name: "Nu Holdings", address: "0x408c14038a04f7bD235329E26d2bf569ee20e250", decimals: 18, cls: "equity" },
  { symbol: "NVDA", name: "NVIDIA", address: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC", decimals: 18, cls: "equity" },
  { symbol: "PFE", name: "Pfizer", address: "0x7066A64c24e4206CD62E83bf198c1E7EB361F51e", decimals: 18, cls: "equity" },
  { symbol: "PLTR", name: "Palantir Technologies", address: "0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A", decimals: 18, cls: "equity" },
  { symbol: "QQQ", name: "Invesco QQQ", address: "0xD5f3879160bc7c32ebb4dC785F8a4F505888de68", decimals: 18, cls: "equity" },
  { symbol: "QUBT", name: "Quantum Computing", address: "0x59818904ab4cE163b3cE4FfB64f2D6Ca02c434B4", decimals: 18, cls: "equity" },
  { symbol: "RBLX", name: "Roblox", address: "0xF0C4BF4C582cb3836e98394b1d4e7B7281101bE8", decimals: 18, cls: "equity" },
  { symbol: "RCAT", name: "Red Cat Holdings", address: "0xFDE6b5d9BB419B10C23268c74e369AbFF39C0460", decimals: 18, cls: "equity" },
  { symbol: "RDDT", name: "Reddit", address: "0x05b37Fb53A299a1b874A619e1c4C404D52C36F4C", decimals: 18, cls: "equity" },
  { symbol: "RIVN", name: "Rivian Automotive", address: "0xB1BF26c1D20ff267A4f93550d1E0d06ac40a114B", decimals: 18, cls: "equity" },
  { symbol: "RKLB", name: "Rocket Lab", address: "0x3b14C39E89D60D627b42a1A4CA45b5bb45Fc12e2", decimals: 18, cls: "equity" },
  { symbol: "SGOV", name: "iShares 0-3 Month Treasury Bond ETF", address: "0x92FD66527192E3e61d4DDd13322Aa222DE86F9B5", decimals: 18, cls: "equity" },
  { symbol: "SHOP", name: "Shopify", address: "0xF53F66751B1Eff985311b693531E3290F600c410", decimals: 18, cls: "equity" },
  { symbol: "SKHY", name: "SK hynix", address: "0x84CAb63bc87912E71ad199ff14A0bA45de68FeF8", decimals: 18, cls: "equity" },
  { symbol: "SLV", name: "iShares Silver Trust", address: "0x411eFb0E7f985935DAec3D4C3ebaEa0d0AD7D89f", decimals: 18, cls: "equity" },
  { symbol: "SNAP", name: "Snap", address: "0xF6589F11Bc40b669e584073F428B05562F568733", decimals: 18, cls: "equity" },
  { symbol: "SNDK", name: "SanDisk", address: "0xB90A19fF0Af67f7779afF50A882A9CfF42446400", decimals: 18, cls: "equity" },
  { symbol: "SNOW", name: "Snowflake", address: "0xBa0CAB75495255d0cB58E22B648bFED4ECD1F47E", decimals: 18, cls: "equity" },
  { symbol: "SPCX", name: "SpaceX Class A", address: "0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa", decimals: 18, cls: "equity" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF", address: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C", decimals: 18, cls: "equity" },
  { symbol: "TSLA", name: "Tesla", address: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d", decimals: 18, cls: "equity" },
  { symbol: "TSM", name: "Taiwan Semiconductor", address: "0x58FfE4a942d3885bAa22D7520691F611EF09e7AA", decimals: 18, cls: "equity" },
  { symbol: "TTWO", name: "Take-Two Interactive", address: "0x5e81213613b6B86EaB4c6c50d718d34359459786", decimals: 18, cls: "equity" },
  { symbol: "UPS", name: "United Parcel Service", address: "0xf23250dac154D05Bb671CB0d0eBEf3c635c79CE2", decimals: 18, cls: "equity" },
  { symbol: "USO", name: "United States Oil Fund", address: "0xa30FA36Db767ad9eD3f7a60fC79526fB4d56D344", decimals: 18, cls: "equity" },
  { symbol: "WYFI", name: "WhiteFiber", address: "0x9e7ABD3C9139D14E4c86DcE0e455AAB7A0C2FB3E", decimals: 18, cls: "equity" },
];

const BY_SYMBOL = new Map(PAIRS.map((p) => [p.symbol.toUpperCase(), p]));

/** What people actually type after the slash. Company names and common nicknames → the pons ticker. */
const ALIASES: Record<string, string> = {
  WETH: "ETH",
  ETHER: "ETH",
  ETHEREUM: "ETH",
  USD: "USDG",
  USDC: "USDG",
  USDT: "USDG",
  DOLLAR: "USDG",
  STABLE: "USDG",
  BTC: "cbBTC",
  BITCOIN: "cbBTC",
  WBTC: "cbBTC",
  BITTENSOR: "TAO",
  APPLE: "AAPL",
  AMAZON: "AMZN",
  BOEING: "BA",
  ALIBABA: "BABA",
  BLACKBERRY: "BB",
  WEBULL: "BULL",
  COINBASE: "COIN",
  COSTCO: "COST",
  CIRCLE: "CRCL",
  DELL: "DELL",
  TRUMP: "DJT",
  FORD: "F",
  FIGMA: "FIG",
  GOLD: "GLD",
  GAMESTOP: "GME",
  GOOGLE: "GOOGL",
  ALPHABET: "GOOGL",
  GOOG: "GOOGL",
  HIMS: "HIMS",
  INTEL: "INTC",
  LILLY: "LLY",
  LOCKHEED: "LMT",
  LULULEMON: "LULU",
  FACEBOOK: "META",
  MODERNA: "MRNA",
  MARVELL: "MRVL",
  MICROSOFT: "MSFT",
  MICROSTRATEGY: "MSTR",
  STRATEGY: "MSTR",
  SAYLOR: "MSTR",
  MICRON: "MU",
  CLOUDFLARE: "NET",
  NETFLIX: "NFLX",
  NUBANK: "NU",
  NVIDIA: "NVDA",
  PFIZER: "PFE",
  PALANTIR: "PLTR",
  NASDAQ: "QQQ",
  ROBLOX: "RBLX",
  REDDIT: "RDDT",
  RIVIAN: "RIVN",
  ROCKETLAB: "RKLB",
  SHOPIFY: "SHOP",
  HYNIX: "SKHY",
  SILVER: "SLV",
  SNAPCHAT: "SNAP",
  SANDISK: "SNDK",
  SNOWFLAKE: "SNOW",
  SPACEX: "SPCX",
  SP500: "SPY",
  TESLA: "TSLA",
  TSMC: "TSM",
  TAIWANSEMI: "TSM",
  TAKETWO: "TTWO",
  OIL: "USO",
  WHITEFIBER: "WYFI",
};

/** Look a pair up by the symbol a poster wrote (case-insensitive). ETH/WETH → native. Company names resolve too. */
export function findPair(symbol: string): PairAsset | null {
  const raw = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const s = ALIASES[raw] ?? raw;
  if (s === "ETH") return ETH_PAIR;
  return BY_SYMBOL.get(s.toUpperCase()) ?? null;
}

export function pairByAddress(address: string): PairAsset {
  const a = address.toLowerCase();
  return PAIRS.find((p) => p.address.toLowerCase() === a) ?? ETH_PAIR;
}

/** Human amount in the pair's units, e.g. "12.4 MSTR", "8,090 USDG", "0.131 cbBTC". */
export function fmtPair(amount: number, pair: PairAsset, digits?: number): string {
  if (!Number.isFinite(amount)) return `— ${pair.symbol}`;
  const d = digits ?? (pair.cls === "stablecoin" ? 0 : pair.cls === "crypto" && pair.symbol === "cbBTC" ? 5 : amount >= 100 ? 1 : amount >= 1 ? 3 : 4);
  const s = amount === 0 ? "0" : amount < Math.pow(10, -d) ? amount.toExponential(2) : amount.toLocaleString("en-US", { maximumFractionDigits: d });
  return `${s} ${pair.symbol}`;
}
