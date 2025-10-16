import { createLogger } from '../config/logger.js';

const logger = createLogger('price-oracle');

/**
 * Bitcoin Price Oracle
 * Fetches BTC price from multiple sources with fallback
 */
export class PriceOracle {
  private cachedPrice: number | null = null;
  private cacheTimestamp: number = 0;
  private readonly cacheTTL = 60000; // 1 minute cache

  /**
   * Get Bitcoin price in USD
   */
  async getBitcoinPrice(): Promise<number> {
    // Return cached price if still valid
    if (this.cachedPrice && Date.now() - this.cacheTimestamp < this.cacheTTL) {
      logger.debug('Returning cached BTC price', { price: this.cachedPrice });
      return this.cachedPrice;
    }

    // Try primary source (CoinGecko)
    try {
      const price = await this.fetchFromCoinGecko();
      this.updateCache(price);
      return price;
    } catch (error) {
      logger.warn('CoinGecko price fetch failed, trying fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Try fallback source (CoinMarketCap)
    try {
      const price = await this.fetchFromCoinMarketCap();
      this.updateCache(price);
      return price;
    } catch (error) {
      logger.warn('CoinMarketCap price fetch failed, trying Binance', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Try Binance as last resort
    try {
      const price = await this.fetchFromBinance();
      this.updateCache(price);
      return price;
    } catch (error) {
      logger.error('All price oracle sources failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Return cached price if available, even if stale
    if (this.cachedPrice) {
      logger.warn('Using stale cached price', {
        price: this.cachedPrice,
        age: Date.now() - this.cacheTimestamp,
      });
      return this.cachedPrice;
    }

    // Fallback to reasonable estimate if all else fails
    logger.error('No price data available, using fallback estimate');
    return 100000; // Conservative estimate ~$100k
  }

  /**
   * Fetch from CoinGecko (Primary)
   */
  private async fetchFromCoinGecko(): Promise<number> {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        bitcoin: { usd: number };
      };

      const price = data.bitcoin.usd;
      logger.debug('Fetched BTC price from CoinGecko', { price });

      return price;
    } catch (error) {
      logger.error('CoinGecko fetch failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Fetch from CoinMarketCap (Fallback)
   */
  private async fetchFromCoinMarketCap(): Promise<number> {
    // Note: Free tier requires API key
    // For production, add CMC_API_KEY to environment variables
    const apiKey = process.env.CMC_API_KEY;

    if (!apiKey) {
      throw new Error('CoinMarketCap API key not configured');
    }

    const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC';

    try {
      const response = await fetch(url, {
        headers: {
          'X-CMC_PRO_API_KEY': apiKey,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        data: { BTC: { quote: { USD: { price: number } } } };
      };

      const price = data.data.BTC.quote.USD.price;
      logger.debug('Fetched BTC price from CoinMarketCap', { price });

      return price;
    } catch (error) {
      logger.error('CoinMarketCap fetch failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Fetch from Binance (Last Resort)
   */
  private async fetchFromBinance(): Promise<number> {
    const url = 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT';

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        symbol: string;
        price: string;
      };

      const price = parseFloat(data.price);
      logger.debug('Fetched BTC price from Binance', { price });

      return price;
    } catch (error) {
      logger.error('Binance fetch failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update price cache
   */
  private updateCache(price: number): void {
    this.cachedPrice = price;
    this.cacheTimestamp = Date.now();
    logger.debug('Updated price cache', { price, timestamp: this.cacheTimestamp });
  }

  /**
   * Clear price cache
   */
  clearCache(): void {
    this.cachedPrice = null;
    this.cacheTimestamp = 0;
    logger.debug('Price cache cleared');
  }

  /**
   * Get cached price info
   */
  getCacheInfo(): { price: number | null; age: number; isStale: boolean } {
    const age = Date.now() - this.cacheTimestamp;
    const isStale = age > this.cacheTTL;

    return {
      price: this.cachedPrice,
      age,
      isStale,
    };
  }
}

// Export singleton instance
export const priceOracle = new PriceOracle();
export default priceOracle;
