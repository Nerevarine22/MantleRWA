module.exports = [
  // Treasuries & Gold (Existing)
  {
    ticker: "PAXG",
    name: "PAX Gold",
    category: "Treasuries & Commodities",
    issuer: "Paxos",
    chain: "ethereum",
    address: "0x45804880De22913dAFE09f4980848ECE6EcbAf78",
    note: "Gold-backed token often used as an onchain RWA proxy.",
    logoUrl: "https://assets.coingecko.com/coins/images/9519/small/paxg.png"
  },
  {
    ticker: "XAUT",
    name: "Tether Gold",
    category: "Treasuries & Commodities",
    issuer: "Tether",
    chain: "ethereum",
    address: "0x68749665FF8D2d112Fa859AA293F07A622782F38",
    note: "Another major gold-backed token with broad market visibility.",
    logoUrl: "https://assets.coingecko.com/coins/images/10481/small/Tether_Gold.png"
  },
  {
    ticker: "ONDO",
    name: "Ondo",
    category: "Treasuries & Commodities",
    issuer: "Ondo Finance",
    chain: "ethereum",
    address: "0xfAbA6f8e4a5e8Ab82F62fe7C39859FA577269BE3",
    note: "Protocol token tied to one of the most visible tokenized-asset ecosystems.",
    logoUrl: "https://assets.coingecko.com/coins/images/34440/small/ondo_logo.png"
  },

  // Tokenized Stocks (xStocks on Mantle via BackedFi/CoinGecko oracle)
  {
    ticker: "xTSLA",
    name: "Backed Tesla",
    category: "Stocks",
    issuer: "xStocks",
    chain: "coingecko",
    address: "backed-tesla",
    note: "Tokenized representation of Tesla Inc. (TSLA)",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/bb/Tesla_T_symbol.svg"
  },
  {
    ticker: "xNVDA",
    name: "Backed Nvidia",
    category: "Stocks",
    issuer: "xStocks",
    chain: "coingecko",
    address: "bndva-backed-nvidia",
    note: "Tokenized representation of Nvidia Corp. (NVDA)",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/21/Nvidia_logo.svg"
  },
  {
    ticker: "xCSPX",
    name: "Backed S&P 500",
    category: "Stocks",
    issuer: "xStocks",
    chain: "coingecko",
    address: "backed-cspx-core-s-p-500",
    note: "Tokenized representation of the S&P 500 ETF",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/04/S%26P_Global_logo.svg"
  },
  {
    ticker: "xMSFT",
    name: "Backed Microsoft",
    category: "Stocks",
    issuer: "xStocks",
    chain: "coingecko",
    address: "backed-microsoft",
    note: "Tokenized representation of Microsoft Corp. (MSFT)",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg"
  },
  {
    ticker: "xCOIN",
    name: "Backed Coinbase",
    category: "Stocks",
    issuer: "xStocks",
    chain: "coingecko",
    address: "backed-coinbase-global",
    note: "Tokenized representation of Coinbase Global (COIN)",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c8/Coinbase_icon.svg"
  },
  {
    ticker: "xMSTR",
    name: "Backed MicroStrategy",
    category: "Stocks",
    issuer: "xStocks",
    chain: "coingecko",
    address: "backed-microstrategy",
    note: "Tokenized representation of MicroStrategy (MSTR)",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ec/MicroStrategy_logo.svg"
  },
  {
    ticker: "xGOOGL",
    name: "Backed Alphabet",
    category: "Stocks",
    issuer: "xStocks",
    chain: "coingecko",
    address: "backed-alphabet-class-a",
    note: "Tokenized representation of Alphabet Class A (GOOGL)",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg"
  },
  {
    ticker: "xGME",
    name: "Backed GameStop",
    category: "Stocks",
    issuer: "xStocks",
    chain: "coingecko",
    address: "backed-gamestop-corp",
    note: "Tokenized representation of GameStop Corp. (GME)",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/05/GameStop_logo.svg"
  },
  {
    ticker: "xNIU",
    name: "Backed Niu",
    category: "Stocks",
    issuer: "xStocks",
    chain: "coingecko",
    address: "backed-niu-technologies",
    note: "Tokenized representation of Niu Technologies (NIU)",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1a/NIU_logo.svg"
  }
];
