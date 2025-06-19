import { geocodingService, standardizeAddress } from './geocodingService';

// CSV 数据加载
export const loadCSVData = async () => {
  try {
    console.log('开始加载 CSV 文件...');
    const response = await fetch('/express_parcel.csv');
    if (!response.ok) {
      throw new Error(`无法加载 CSV 文件: ${response.status} ${response.statusText}`);
    }
    
    const csvText = await response.text();
    console.log('CSV 文件读取成功，文件大小:', csvText.length, '字符');
    
    return parseCSV(csvText);
  } catch (error) {
    console.error('CSV 加载失败:', error);
    throw new Error(`CSV 文件加载失败: ${error.message}`);
  }
};

// CSV 解析器
const parseCSV = (csvText) => {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) {
    throw new Error('CSV 文件为空');
  }
  
  const headers = parseCSVLine(lines[0]);
  console.log('CSV 字段:', headers.slice(0, 10), '...(共', headers.length, '个字段)');
  
    const data = [];
    let rowCount = 0;
    const maxRows = 200; // 限制只读取200行数据

    for (let i = 1; i < lines.length && rowCount < maxRows; i++) {
    if (lines[i].trim()) {
        const values = parseCSVLine(lines[i]);
        if (values.length >= headers.length - 5) { // 允许少量字段缺失
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        data.push(row);
        rowCount++; // 增加计数器
        }
      }
    }
  
  console.log(`CSV 解析完成: ${data.length} 行数据`);
  return data;
};

// 解析 CSV 行
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
};

// 主数据处理函数
export const processLogisticsData = async (rawData, progressCallback) => {
  console.log(' 开始处理物流数据...');
  
  // 1. 数据验证和清理
  const validData = rawData.filter(row => {
    const hasShipperZip = row.shipper_postal_code && cleanZipCode(row.shipper_postal_code);
    const hasShiptoZip = row.shipto_postal_code && cleanZipCode(row.shipto_postal_code);
    const differentLocations = row.shipper_postal_code !== row.shipto_postal_code;
    
    return hasShipperZip && hasShiptoZip && differentLocations;
  });
  
  console.log(` 数据验证完成: ${validData.length}/${rawData.length} 条有效数据`);
  
  if (validData.length === 0) {
    throw new Error('没有找到有效的运输数据。请检查 CSV 文件中的 shipper_postal_code 和 shipto_postal_code 字段。');
  }

  // 2. 收集唯一地址
  const uniqueAddresses = new Map();
  
  validData.forEach(row => {
    // 发货地址
    const shipperAddr = standardizeAddress(
      row.shipper_address_line_one,
      row.shipper_city,
      row.shipper_province_code,
      row.shipper_postal_code
    );
    if (shipperAddr.zipCode) {
      const shipperKey = `${shipperAddr.zipCode}-${shipperAddr.city}`;
      uniqueAddresses.set(shipperKey, shipperAddr);
    }
    
    // 收货地址
    const shiptoAddr = standardizeAddress(
      row.shipto_address_line_one,
      row.shipto_city,
      row.shipto_province_code,
      row.shipto_postal_code
    );
    if (shiptoAddr.zipCode) {
      const shiptoKey = `${shiptoAddr.zipCode}-${shiptoAddr.city}`;
      uniqueAddresses.set(shiptoKey, shiptoAddr);
    }
  });
  
  console.log(` 需要地理编码的唯一地址: ${uniqueAddresses.size} 个`);

  // 3. 批量地理编码
  console.log(' 开始地理编码...');
  const addressList = Array.from(uniqueAddresses.values());
  const geocodeResults = await geocodingService.geocodeBatch(addressList, progressCallback);
  
  // 4. 创建坐标映射
  const coordinateMap = new Map();
  let successCount = 0;
  
  addressList.forEach((addr, index) => {
    const key = `${addr.zipCode}-${addr.city}`;
    const result = geocodeResults[index];
    if (result && result.latitude && result.longitude) {
      coordinateMap.set(key, result);
      successCount++;
    }
  });
  
  console.log(` 地理编码完成: ${successCount}/${uniqueAddresses.size} 个地址成功`);
  
  // 5. 生成最终数据
  const processedData = validData
    .map((row, index) => {
      const shipperKey = `${cleanZipCode(row.shipper_postal_code)}-${row.shipper_city}`;
      const shiptoKey = `${cleanZipCode(row.shipto_postal_code)}-${row.shipto_city}`;
      
      const shipperCoords = coordinateMap.get(shipperKey);
      const shiptoCoords = coordinateMap.get(shiptoKey);
      
      if (!shipperCoords || !shiptoCoords) {
        return null;
      }
      
      return {
        // 基础信息
        id: row.id || index + 1,
        job_num: row.job_num || `JOB-${index + 1}`,
        created_time: row.created_time || new Date().toISOString().split('T')[0],
        
        // 运输信息
        carrier: row.carrier || '未知承运商',
        shipment_type: row.shipment_type || 'PARCEL',
        status: row.status || 'unknown',
        
        // 发货地信息
        shipper_company: row.shipper_company_name || '未知公司',
        shipper_city: row.shipper_city || '未知城市',
        shipper_state: row.shipper_province_code || '',
        shipper_zipcode: cleanZipCode(row.shipper_postal_code),
        shipper_lat: shipperCoords.latitude,
        shipper_lng: shipperCoords.longitude,
        
        // 收货地信息
        shipto_company: row.shipto_company_name || '未知公司',
        shipto_city: row.shipto_city || '未知城市',
        shipto_state: row.shipto_province_code || '',
        shipto_zipcode: cleanZipCode(row.shipto_postal_code),
        shipto_lat: shiptoCoords.latitude,
        shipto_lng: shiptoCoords.longitude,
        
        // 货物信息
        weight: parseFloat(row.gw) || 0,
        volume: parseFloat(row.vol) || 0,
        cargo_value: parseFloat(row.cargo_value) || 0,
        packages: parseInt(row.pkg_num) || 1,
        
        // 计算距离
        distance: calculateDistance(
          shipperCoords.latitude, shipperCoords.longitude,
          shiptoCoords.latitude, shiptoCoords.longitude
        )
      };
    })
    .filter(item => item !== null);
  
  const stats = {
    originalCount: rawData.length,
    validCount: validData.length,
    geocodedCount: processedData.length,
    geocodeSuccessRate: Math.round((successCount / uniqueAddresses.size) * 100)
  };
  
  console.log(' 处理统计:', stats);
  
  return { data: processedData, stats };
};

// 计算两点间距离
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c);
};

// 简单的邮编清理函数
const cleanZipCode = (zipCode) => {
  if (!zipCode) return null;
  const cleaned = zipCode.toString().replace(/\D/g, '');
  if (cleaned.length === 5) return cleaned;
  if (cleaned.length === 9) return cleaned.substring(0, 5);
  if (cleaned.length === 4) return '0' + cleaned;
  return null;
};