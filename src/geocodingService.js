// 美国人口普查局地理编码服务
class CensusGeocodingService {
  constructor() {
    this.baseUrl = 'https://geocoding.geo.census.gov/geocoder/locations';
    this.cache = new Map(); // 缓存已查询的结果
    this.failedCache = new Set(); // 缓存失败的查询
  }

  // 单个地址地理编码
  async geocodeAddress(address, city, state, zipCode) {
    const cacheKey = `${zipCode}-${city}-${state}`.toLowerCase().trim();
    
    // 检查缓存
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    // 检查失败缓存
    if (this.failedCache.has(cacheKey)) {
      return null;
    }

    try {
      // 构建查询参数，优先使用邮编
      const params = new URLSearchParams({
        format: 'json',
        benchmark: 'Public_AR_Current',
        vintage: 'Current_Current'
      });

      // 如果有邮编，优先使用邮编查询
      if (zipCode) {
        params.append('zip', zipCode);
      }
      
      // 添加城市和州作为辅助信息
      if (city) params.append('city', city);
      if (state) params.append('state', state);
      if (address) params.append('address', address);

      const response = await fetch(`${this.baseUrl}/onelineaddress?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const data = await response.json();
      
      let result = null;
      if (data.result && data.result.addressMatches && data.result.addressMatches.length > 0) {
        const match = data.result.addressMatches[0];
        if (match.coordinates && match.coordinates.x && match.coordinates.y) {
          result = {
            latitude: parseFloat(match.coordinates.y),
            longitude: parseFloat(match.coordinates.x),
            matchScore: parseFloat(match.matchedAddress?.score || 100),
            formattedAddress: match.matchedAddress?.formattedAddress || `${city}, ${state} ${zipCode}`
          };
        }
      }

      // 缓存结果
      if (result) {
        this.cache.set(cacheKey, result);
      } else {
        this.failedCache.add(cacheKey);
      }
      
      return result;

    } catch (error) {
      console.warn(`地理编码失败: ${cacheKey}`, error.message);
      this.failedCache.add(cacheKey);
      return null;
    }
  }

  // 批量地理编码
  async geocodeBatch(addresses, progressCallback) {
    const results = [];
    const batchSize = 3; // 减少批次大小，避免请求过于频繁
    
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      const batchPromises = batch.map(addr => 
        this.geocodeAddress(addr.address, addr.city, addr.state, addr.zipCode)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // 更新进度
      if (progressCallback) {
        progressCallback({
          completed: Math.min(i + batchSize, addresses.length),
          total: addresses.length,
          percentage: Math.round((Math.min(i + batchSize, addresses.length) / addresses.length) * 100)
        });
      }
      
      // 添加延迟避免请求过于频繁
      if (i + batchSize < addresses.length) {
        await this.delay(300); // 300ms 延迟
      }
    }
    
    return results;
  }

  // 延迟函数
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 获取缓存统计
  getCacheStats() {
    return {
      cached: this.cache.size,
      failed: this.failedCache.size,
      total: this.cache.size + this.failedCache.size
    };
  }

  // 清除缓存
  clearCache() {
    this.cache.clear();
    this.failedCache.clear();
  }
}

// 创建全局实例
export const geocodingService = new CensusGeocodingService();

// 邮编清理和验证
export const cleanZipCode = (zipCode) => {
  if (!zipCode) return null;
  
  const cleaned = zipCode.toString().replace(/\D/g, '');
  
  if (cleaned.length === 5) {
    return cleaned;
  } else if (cleaned.length === 9) {
    return cleaned.substring(0, 5);
  } else if (cleaned.length === 4) {
    return '0' + cleaned;
  }
  
  return null;
};

// 地址标准化
export const standardizeAddress = (addressLine, city, state, zipCode) => {
  return {
    address: addressLine ? addressLine.trim() : '',
    city: city ? city.trim() : '',
    state: state ? state.trim().toUpperCase() : '',
    zipCode: cleanZipCode(zipCode)
  };
};