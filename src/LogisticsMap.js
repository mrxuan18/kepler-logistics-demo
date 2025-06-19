import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { addDataToMap } from '@kepler.gl/actions';
import KeplerGl from '@kepler.gl/components';

const LogisticsMap = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [processedData, setProcessedData] = useState([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const dispatch = useDispatch();

  // Warehouse 邮编映射
  const warehouseZipcodeMapping = {
    'NJ9': '07114', 'NJ8': '07201', 'NJ7': '08817', 'NJ-Main': '07306',
    'TX8828': '75261', 'TX8829': '76155', 'TX-DFW': '75063', 'TX-Houston': '77032',
    'WNT485': '90248', 'WNT486': '91761', 'WNT487': '92408',
    'CA-LA': '90058', 'CA-SF': '94080', 'CA-OAK': '94621',
    'Unknown': '07114', 'MAIN': '10001', 'NYC-Main': '11378',
  };

  // 邮编坐标映射
  const zipcodeCoords = {
    '07114': { lat: 40.7282, lng: -74.1776, city: 'Newark, NJ' },
    '07201': { lat: 40.6632, lng: -74.2107, city: 'Elizabeth, NJ' },
    '08817': { lat: 40.5187, lng: -74.4121, city: 'Edison, NJ' },
    '07306': { lat: 40.7282, lng: -74.0776, city: 'Jersey City, NJ' },
    '75261': { lat: 32.7767, lng: -96.7970, city: 'Dallas, TX' },
    '76155': { lat: 32.7555, lng: -97.3308, city: 'Fort Worth, TX' },
    '75063': { lat: 32.8140, lng: -96.9489, city: 'Irving, TX' },
    '77032': { lat: 29.7604, lng: -95.3698, city: 'Houston, TX' },
    '90248': { lat: 33.8883, lng: -118.3090, city: 'Gardena, CA' },
    '91761': { lat: 34.0633, lng: -117.6508, city: 'Ontario, CA' },
    '92408': { lat: 34.1083, lng: -117.2898, city: 'San Bernardino, CA' },
    '90058': { lat: 33.9425, lng: -118.2437, city: 'Los Angeles, CA' },
    '94080': { lat: 37.6548, lng: -122.4077, city: 'South San Francisco, CA' },
    '94621': { lat: 37.7749, lng: -122.2364, city: 'Oakland, CA' },
    '10001': { lat: 40.7128, lng: -74.0060, city: 'New York, NY' },
    '11378': { lat: 40.7282, lng: -73.9109, city: 'Queens, NY' },
  };

  // 获取 warehouse 邮编
  const getWarehouseZipcode = (warehouseName) => {
    if (!warehouseName) return warehouseZipcodeMapping['Unknown'];
    const warehouse = warehouseName.toString().trim();
    
    // 直接匹配
    if (warehouseZipcodeMapping[warehouse]) return warehouseZipcodeMapping[warehouse];
    
    // 前缀匹配
    const upperWarehouse = warehouse.toUpperCase();
    if (upperWarehouse.startsWith('NJ')) return '07114';
    if (upperWarehouse.startsWith('TX')) return '75261';
    if (upperWarehouse.startsWith('WNT')) return '90248';
    if (upperWarehouse.startsWith('CA')) return '90058';
    if (upperWarehouse.includes('NYC')) return '11378';
    
    return warehouseZipcodeMapping['Unknown'];
  };

  // 清理邮编
  const cleanZipcode = (zipcode) => {
    if (!zipcode) return null;
    const cleaned = zipcode.toString().replace(/\D/g, '');
    return cleaned.length >= 5 ? cleaned.substring(0, 5) : null;
  };

  // 通过邮编API获取坐标
  const getCoordinatesFromZipcode = async (zipcode) => {
    if (!zipcode) return { lat: null, lng: null, city: 'Unknown' };
    
    try {
      const response = await fetch(`http://api.zippopotam.us/us/${zipcode}`);
      if (response.ok) {
        const data = await response.json();
        if (data.places && data.places.length > 0) {
          const place = data.places[0];
          return {
            lat: parseFloat(place.latitude),
            lng: parseFloat(place.longitude),
            city: `${place['place name']}, ${place['state abbreviation']}`
          };
        }
      }
    } catch (error) {
      console.warn(`邮编 ${zipcode} 获取坐标失败:`, error);
    }
    
    return { lat: null, lng: null, city: 'Unknown' };
  };

  // 处理时间戳为标准格式（参考Python版本）
  const processTimestamp = (timestampStr) => {
    if (!timestampStr) return { date: null, datetime: null, timestamp: null };
    
    try {
      let dt = null;
      
      if (typeof timestampStr === 'string') {
        timestampStr = timestampStr.trim();
        
        // 处理 MM/DD/YY HH:MM 格式
        if (timestampStr.includes('/') && timestampStr.includes(' ')) {
          // 例如：12/15/23 14:30
          const parts = timestampStr.split(' ');
          const datePart = parts[0];
          const timePart = parts[1] || '00:00';
          
          const [month, day, year] = datePart.split('/');
          let fullYear = parseInt(year);
          
          // 处理两位数年份
          if (fullYear < 50) {
            fullYear = 2000 + fullYear;
          } else if (fullYear < 100) {
            fullYear = 1900 + fullYear;
          }
          
          dt = new Date(`${month}/${day}/${fullYear} ${timePart}`);
        }
        // 处理其他格式
        else {
          dt = new Date(timestampStr);
        }
      } else if (typeof timestampStr === 'number') {
        // Unix 时间戳处理
        if (timestampStr > 1e10) {
          dt = new Date(timestampStr); // 毫秒
        } else {
          dt = new Date(timestampStr * 1000); // 秒
        }
      }
      
      if (dt && !isNaN(dt.getTime())) {
        // 验证日期是否合理（1990-2030年之间）
        const year = dt.getFullYear();
        if (year >= 1990 && year <= 2030) {
          return {
            date: dt.toISOString().split('T')[0], // YYYY-MM-DD
            datetime: dt.toISOString().replace('T', ' ').replace('.000Z', ''), // YYYY-MM-DD HH:MM:SS
            timestamp: dt.getTime() // Unix timestamp in milliseconds
          };
        }
      }
    } catch (error) {
      console.warn(`时间解析失败: ${timestampStr}`, error);
    }
    
    return { date: null, datetime: null, timestamp: null };
  };

  // 加载并处理数据
  const loadAndProcessData = async () => {
    setLoading(true);
    setError(null);
    setMapLoaded(false);
    
    try {
      console.log('🚀 开始加载数据...');
      
      const response = await fetch('/express_parcel.csv');
      if (!response.ok) throw new Error('无法读取 CSV 文件');
      
      const csvText = await response.text();
      const lines = csvText.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      console.log('📂 CSV 字段:', headers.slice(0, 15));
      
      // 检查是否存在 order_time 字段
      const hasOrderTime = headers.includes('order_time');
      console.log('📅 order_time 字段存在:', hasOrderTime);
      
      if (!hasOrderTime) {
        console.warn('⚠️ CSV文件中没有找到 order_time 字段，将使用 created_time 作为备用');
      }
      
      // 解析前200行数据（仿照Python版本）
      const rawData = [];
      for (let i = 1; i <= 200 && i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        rawData.push(row);
      }
      
      setData(rawData);
      
      // 处理数据用于 Kepler.gl
      const mapDataArray = [];
      
      console.log('🌍 开始获取目的地坐标...');
      
      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        
        // 过滤条件：必须有仓库名、目的地邮编，并且成功获取了时间信息
        if (!row.warehouse_name || !row.shipto_postal_code) continue;
        
        // 处理时间戳 - 参考Python版本的处理方法
        let timeInfo = { date: null, datetime: null, timestamp: null };
        
        // 按优先级尝试不同的时间字段，主要使用 created_time
        const timeFields = ['created_time', 'order_time', 'act_time', 'in_time'];
        for (const field of timeFields) {
          if (row[field]) {
            timeInfo = processTimestamp(row[field]);
            if (timeInfo.date) {
              console.log(`✓ 使用 ${field} 字段: ${row[field]} → ${timeInfo.date}`);
              break;
            }
          }
        }
        
        // 如果所有时间字段都无效，使用当前日期
        if (!timeInfo.date) {
          const now = new Date();
          timeInfo = {
            date: now.toISOString().split('T')[0],
            datetime: now.toISOString().replace('T', ' ').replace('.000Z', ''),
            timestamp: now.getTime()
          };
          console.log(`⚠️ 使用默认日期: ${timeInfo.date}`);
        }
        
        const warehouseZip = getWarehouseZipcode(row.warehouse_name);
        const warehouseCoords = zipcodeCoords[warehouseZip] || { lat: 40.7128, lng: -74.0060, city: 'Unknown' };
        
        // 清理目的地邮编
        const destZip = cleanZipcode(row.shipto_postal_code);
        
        if (!destZip) continue;
        
        console.log(`处理 ${i + 1}/${rawData.length}: ${row.warehouse_name} → ${destZip}`);
        
        // 通过API获取目的地坐标
        const destCoords = await getCoordinatesFromZipcode(destZip);
        
        // 如果获取坐标失败，跳过这条记录
        if (!destCoords.lat || !destCoords.lng) {
          console.warn(`跳过记录: 邮编 ${destZip} 无法获取坐标`);
          continue;
        }
        
        const distance = Math.sqrt(
          Math.pow(destCoords.lat - warehouseCoords.lat, 2) + 
          Math.pow(destCoords.lng - warehouseCoords.lng, 2)
        ) * 111;
        
        mapDataArray.push({
          id: i + 1,
          job_num: row.job_num || `JOB-${i + 1}`,
          warehouse_name: row.warehouse_name,
          warehouse_zipcode: warehouseZip,
          warehouse_lat: warehouseCoords.lat,
          warehouse_lng: warehouseCoords.lng,
          warehouse_city: warehouseCoords.city,
          dest_city: row.shipto_city || destCoords.city,
          dest_zipcode: destZip,
          dest_lat: destCoords.lat,
          dest_lng: destCoords.lng,
          dest_full_city: destCoords.city,
          carrier: row.carrier || '未知承运商',
          shipment_date: timeInfo.date,
          shipment_datetime: timeInfo.datetime,
          shipment_timestamp: timeInfo.timestamp,
          created_time: row.created_time || '',
          distance: Math.round(distance),
          weight: parseFloat(row.gw) || 1,
          volume: parseFloat(row.vol) || 0.1
        });
        
        // 添加小延时避免API限制
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log('✅ 处理完成:', mapDataArray.length, '条数据');
      console.log('🔍 数据样本:', mapDataArray[0]);
      
      // 检查日期数据
      const validDates = mapDataArray.filter(item => item.shipment_date).length;
      console.log(`📅 有效日期数据: ${validDates}/${mapDataArray.length}`);
      
      if (validDates > 0) {
        const uniqueDates = [...new Set(mapDataArray.map(item => item.shipment_date))].sort();
        console.log('📆 日期范围:', uniqueDates[0], '至', uniqueDates[uniqueDates.length - 1]);
        
        // 显示日期分布统计
        const dateStats = {};
        mapDataArray.forEach(item => {
          if (item.shipment_date) {
            dateStats[item.shipment_date] = (dateStats[item.shipment_date] || 0) + 1;
          }
        });
        
        console.log('📊 日期分布:');
        Object.entries(dateStats).sort().forEach(([date, count]) => {
          console.log(`   ${date}: ${count} 笔`);
        });
      }
      
      setProcessedData(mapDataArray);
      
      // 手动构建 Kepler.gl 数据格式 - 避免 processRowObject 兼容性问题
      if (mapDataArray.length > 0) {
        console.log('🗺️ 手动构建 Kepler.gl 数据格式...');
        
        const keplerData = {
          fields: [
            {name: 'warehouse_lat', type: 'real'},
            {name: 'warehouse_lng', type: 'real'},
            {name: 'dest_lat', type: 'real'},
            {name: 'dest_lng', type: 'real'},
            {name: 'job_num', type: 'string'},
            {name: 'warehouse_name', type: 'string'},
            {name: 'dest_city', type: 'string'},
            {name: 'carrier', type: 'string'},
            {name: 'distance', type: 'integer'},
            {name: 'weight', type: 'real'},
            {name: 'shipment_date', type: 'timestamp'},  // 添加时间字段
            {name: 'shipment_timestamp', type: 'timestamp'}  // 添加时间戳字段
          ],
          rows: mapDataArray.map(item => [
            item.warehouse_lat,
            item.warehouse_lng,
            item.dest_lat,
            item.dest_lng,
            item.job_num,
            item.warehouse_name,
            item.dest_city,
            item.carrier,
            item.distance,
            item.weight,
            item.shipment_datetime || item.shipment_date,  // 使用完整的日期时间或仅日期
            item.shipment_timestamp  // Unix timestamp
          ])
        };
        
        console.log('📊 Kepler.gl 数据格式:', keplerData);
        console.log('🕐 时间数据示例:', keplerData.rows[0][10], keplerData.rows[0][11]);
        
        const dataset = {
          info: {
            label: 'Express Parcel 物流数据',
            id: 'express_parcel_data'
          },
          data: keplerData
        };
        
        console.log('📤 向 Kepler.gl 发送数据...');
        dispatch(addDataToMap({
          datasets: dataset,
          options: {
            centerMap: true,
            readOnly: false
          },
          config: {
            version: 'v1',
            config: {
              mapState: {
                latitude: 39.8,
                longitude: -95.0,
                zoom: 4,
                pitch: 0,
                bearing: 0
              },
              visState: {
                filters: [
                  {
                    dataId: ['express_parcel_data'],
                    id: 'shipment_date_filter',
                    name: ['shipment_date'],  // 使用 shipment_date 字段
                    type: 'timeRange',
                    value: [],  // 初始为空，将显示所有数据
                    enlarged: true,
                    plotType: 'histogram',
                    animationWindow: 'free',
                    enabled: true
                  }
                ],
                layers: [
                  {
                    id: 'shipping_routes',
                    type: 'arc',
                    config: {
                      dataId: 'express_parcel_data',
                      label: '🚛 运输路线',
                      color: [255, 153, 51],
                      columns: {
                        lat0: 'warehouse_lat',
                        lng0: 'warehouse_lng',
                        lat1: 'dest_lat',
                        lng1: 'dest_lng'
                      },
                      isVisible: true,
                      visConfig: {
                        opacity: 0.8,
                        thickness: 3,
                        colorRange: {
                          name: 'Global Warming',
                          type: 'sequential',
                          category: 'Uber',
                          colors: ['#5A1846', '#900C3F', '#C70039', '#E3611C', '#F1920E', '#FFC300']
                        },
                        sizeRange: [1, 10],
                        targetColor: [255, 153, 51]
                      }
                    }
                  },
                  {
                    id: 'warehouses',
                    type: 'point',
                    config: {
                      dataId: 'express_parcel_data',
                      label: '🏢 仓库',
                      color: [51, 255, 51],
                      columns: {
                        lat: 'warehouse_lat',
                        lng: 'warehouse_lng'
                      },
                      isVisible: true,
                      visConfig: {
                        radius: 15,
                        opacity: 0.9,
                        outline: true,
                        thickness: 2,
                        strokeColor: [255, 255, 255],
                        colorRange: {
                          name: 'ColorBrewer Set3',
                          colors: ['#8DD3C7', '#FFFFB3', '#BEBADA', '#FB8072', '#80B1D3']
                        },
                        radiusRange: [10, 30]
                      }
                    }
                  },
                  {
                    id: 'destinations',
                    type: 'point',
                    config: {
                      dataId: 'express_parcel_data',
                      label: '🎯 目的地',
                      color: [51, 153, 255],
                      columns: {
                        lat: 'dest_lat',
                        lng: 'dest_lng'
                      },
                      isVisible: true,
                      visConfig: {
                        radius: 8,
                        opacity: 0.7,
                        outline: true,
                        thickness: 1,
                        strokeColor: [255, 255, 255],
                        colorRange: {
                          name: 'Uber Viz Qualitative 1',
                          colors: ['#12939A', '#DDB27C', '#88572C', '#FF991F', '#F15C17']
                        },
                        radiusRange: [5, 20]
                      }
                    }
                  }
                ],
                interactionConfig: {
                  tooltip: {
                    fieldsToShow: {
                      express_parcel_data: [
                        { name: 'job_num', format: null },
                        { name: 'warehouse_name', format: null },
                        { name: 'dest_city', format: null },
                        { name: 'carrier', format: null },
                        { name: 'distance', format: null },
                        { name: 'shipment_date', format: null }  // 在工具提示中显示日期
                      ]
                    }
                  },
                  brush: { size: 0.5, enabled: false },
                  geocoder: { enabled: true },
                  coordinate: { enabled: true }
                }
              },
              mapStyle: {
                styleType: 'dark',
                topLayerGroups: {},
                visibleLayerGroups: {
                  label: true,
                  road: true,
                  border: false,
                  building: true,
                  water: true,
                  land: true,
                  '3d building': false
                }
              }
            }
          }
        }));
        
        setTimeout(() => setMapLoaded(true), 1500);
      }
      
    } catch (err) {
      console.error('❌ 错误:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAndProcessData();
  }, [dispatch]);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* 状态信息面板 */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '10px 15px',
        borderRadius: 8,
        maxWidth: '300px'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>📊 数据状态</h3>
        {loading && <p>⏳ 正在加载数据...</p>}
        {error && <p style={{ color: '#ff6b6b' }}>❌ 错误: {error}</p>}
        {processedData.length > 0 && (
          <>
            <p>✅ 已加载 {processedData.length} 条物流记录</p>
            <p>📅 时间筛选器已启用</p>
            <p style={{ fontSize: '12px', marginTop: '10px' }}>
              💡 提示: 使用左侧面板的时间筛选器来查看不同日期的物流数据
            </p>
          </>
        )}
      </div>

      {/* Kepler.gl 地图 */}
      <KeplerGl
        id="logistics-map"
        mapboxApiAccessToken="pk.eyJ1IjoieXV4dWFsYW4iLCJhIjoiY21idG03YmZlMDR2bDJxcHVoZjRjY2l2ciJ9.7NP8FWPFIAWtr7rLkhlc1A"
        width={window.innerWidth}
        height={window.innerHeight}
        appName="Express Parcel 物流可视化系统"
        version="v1"
      />
    </div>
  );
};

export default LogisticsMap;