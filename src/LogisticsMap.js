import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import KeplerGl from '@kepler.gl/components';
import { addDataToMap } from '@kepler.gl/actions';
import { loadCSVData, processLogisticsData } from './dataProcessor';

// 你的 Mapbox Token
const MAPBOX_TOKEN = "pk.eyJ1IjoieXV4dWFsYW4iLCJhIjoiY21idG03YmZlMDR2bDJxcHVoZjRjY2l2ciJ9.7NP8FWPFIAWtr7rLkhlc1A";

// Kepler.gl 地图配置
const getMapConfig = () => ({
  version: 'v1',
  config: {
    visState: {
      layers: [
        {
          id: 'shipment-arcs',
          type: 'arc',
          config: {
            dataId: 'logistics',
            label: '🚛 运输路径',
            color: [255, 203, 153],
            columns: {
              lat0: 'shipper_lat',
              lng0: 'shipper_lng',
              lat1: 'shipto_lat',
              lng1: 'shipto_lng'
            },
            isVisible: true,
            visConfig: {
              opacity: 0.8,
              thickness: 2,
              colorRange: {
                name: 'Global Warming',
                type: 'sequential',
                category: 'Uber',
                colors: ['#5A1846', '#900C3F', '#C70039', '#E3611C', '#F1920E', '#FFC300']
              },
              sizeRange: [1, 10],
              targetColor: [255, 203, 153]
            }
          }
        },
        {
          id: 'origin-points',
          type: 'point',
          config: {
            dataId: 'logistics',
            label: '📦 发货点',
            color: [23, 184, 190],
            columns: {
              lat: 'shipper_lat',
              lng: 'shipper_lng'
            },
            isVisible: true,
            visConfig: {
              radius: 8,
              opacity: 0.8,
              outline: true,
              thickness: 2,
              strokeColor: [255, 255, 255],
              colorRange: {
                name: 'Uber Viz Qualitative 1',
                type: 'qualitative',
                category: 'Uber',
                colors: ['#12939A', '#DDB27C', '#88572C', '#FF991F', '#F15C17']
              },
              radiusRange: [3, 30]
            }
          }
        },
        {
          id: 'destination-points',
          type: 'point',
          config: {
            dataId: 'logistics',
            label: '🎯 收货点',
            color: [255, 153, 153],
            columns: {
              lat: 'shipto_lat',
              lng: 'shipto_lng'
            },
            isVisible: true,
            visConfig: {
              radius: 6,
              opacity: 0.7,
              outline: true,
              thickness: 1,
              strokeColor: [255, 255, 255],
              colorRange: {
                name: 'ColorBrewer Set3',
                type: 'qualitative',
                category: 'ColorBrewer',
                colors: ['#8DD3C7', '#FFFFB3', '#BEBADA', '#FB8072', '#80B1D3']
              },
              radiusRange: [2, 25]
            }
          }
        }
      ],
      filters: [],
      interactionConfig: {
        tooltip: {
          fieldsToShow: {
            logistics: [
              { name: 'job_num', format: null },
              { name: 'carrier', format: null },
              { name: 'shipper_city', format: null },
              { name: 'shipper_zipcode', format: null },
              { name: 'shipto_city', format: null },
              { name: 'shipto_zipcode', format: null },
              { name: 'distance', format: null },
              { name: 'weight', format: null }
            ]
          }
        },
        brush: { size: 0.5, enabled: false },
        geocoder: { enabled: true },
        coordinate: { enabled: true }
      }
    },
    mapState: {
      bearing: 0,
      dragRotate: false,
      latitude: 39.8283,
      longitude: -98.5795,
      pitch: 0,
      zoom: 4,
      isSplit: false
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
});

const LogisticsMap = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0, percentage: 0 });
  const [stats, setStats] = useState({ 
    total: 0, 
    carriers: 0, 
    avgDistance: 0,
    geocodeSuccessRate: 0 
  });
  const dispatch = useDispatch();

  // 进度更新回调
  const handleProgress = (progressData) => {
    setProgress(progressData);
  };

  // 加载和处理数据
  const loadData = async () => {
    setLoading(true);
    setError(null);
    setProgress({ completed: 0, total: 0, percentage: 0 });
    
    try {
      console.log('🚀 开始加载物流数据...');
      
      // 1. 加载 CSV 数据
      const rawData = await loadCSVData();
      console.log(`📄 CSV 数据加载完成: ${rawData.length} 条记录`);
      
      // 2. 处理数据并进行地理编码
      console.log('🌍 开始地理编码处理...');
      const result = await processLogisticsData(rawData, handleProgress);
      
      if (result.data.length === 0) {
        throw new Error('处理后没有有效的数据可以显示。请检查 CSV 文件中的邮编字段格式。');
      }
      
      // 3. 计算统计信息
      const carriers = [...new Set(result.data.map(d => d.carrier))];
      const avgDistance = result.data.reduce((sum, d) => sum + d.distance, 0) / result.data.length;
      
      setStats({
        total: result.data.length,
        carriers: carriers.length,
        avgDistance: Math.round(avgDistance),
        geocodeSuccessRate: result.stats.geocodeSuccessRate
      });
      
      // 4. 加载数据到 Kepler.gl
      console.log('🗺️ 正在加载数据到地图...');
      dispatch(addDataToMap({
        datasets: {
          info: {
            label: 'logistics',
            id: 'logistics'
          },
          data: result.data
        },
        option: {
          centerMap: true,
          readOnly: false
        },
        config: getMapConfig().config
      }));
      
      console.log('✅ 数据加载完成！');
      
    } catch (err) {
      console.error('❌ 数据加载失败:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setProgress({ completed: 0, total: 0, percentage: 0 });
    }
  };

  // 组件挂载时自动加载数据
  useEffect(() => {
    loadData();
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* 控制面板 */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.9)',
        color: 'white',
        padding: '20px',
        borderRadius: '12px',
        minWidth: '380px',
        fontFamily: 'Arial, sans-serif',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <h3 style={{ 
          margin: '0 0 15px 0', 
          fontSize: '20px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontWeight: 'bold'
        }}>
          🚚 基于邮编的物流可视化
        </h3>
        
        {loading && (
          <div>
            <p style={{ margin: '10px 0', fontSize: '16px' }}>
              📊 正在处理数据...
            </p>
            {progress.total > 0 && (
              <div>
                <p style={{ fontSize: '14px', margin: '8px 0', color: '#ccc' }}>
                  地理编码进度: {progress.completed}/{progress.total} ({progress.percentage}%)
                </p>
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#333',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  marginTop: '10px'
                }}>
                  <div style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease',
                    width: `${progress.percentage}%`
                  }}></div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {error && (
          <div style={{ 
            color: '#ff6b6b', 
            padding: '15px', 
            backgroundColor: 'rgba(255,107,107,0.1)', 
            borderRadius: '8px',
            border: '1px solid rgba(255,107,107,0.3)',
            marginTop: '10px'
          }}>
            <strong>❌ 错误:</strong><br/>
            {error}
          </div>
        )}
        
        {!loading && !error && stats.total > 0 && (
          <div>
            <div style={{ 
              background: 'rgba(255,255,255,0.05)',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '15px'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <p style={{ margin: '5px 0', fontSize: '14px' }}>
                    <span style={{ color: '#667eea' }}>📦</span> <strong>总运单:</strong> {stats.total}
                  </p>
                  <p style={{ margin: '5px 0', fontSize: '14px' }}>
                    <span style={{ color: '#667eea' }}>🚛</span> <strong>承运商:</strong> {stats.carriers} 家
                  </p>
                </div>
                <div>
                  <p style={{ margin: '5px 0', fontSize: '14px' }}>
                    <span style={{ color: '#667eea' }}>📏</span> <strong>平均距离:</strong> {stats.avgDistance} 公里
                  </p>
                  <p style={{ margin: '5px 0', fontSize: '14px' }}>
                    <span style={{ color: '#667eea' }}>🎯</span> <strong>编码成功率:</strong> {stats.geocodeSuccessRate}%
                  </p>
                </div>
              </div>
            </div>
            
            <button 
              onClick={loadData}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                width: '100%',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
              }}
            >
              🔄 重新加载数据
            </button>
          </div>
        )}
        
        <div style={{ 
          marginTop: '15px', 
          fontSize: '12px', 
          color: '#888',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: '10px'
        }}>
          <p style={{ margin: '0' }}>💡 使用美国人口普查局 API 进行精确地理编码</p>
          <p style={{ margin: '5px 0 0 0' }}>🗺️ 地图由 Mapbox 提供支持</p>
        </div>
      </div>

      {/* Kepler.gl 地图 */}
      <KeplerGl
        id="logistics-map"
        mapboxApiAccessToken={MAPBOX_TOKEN}
        width={window.innerWidth}
        height={window.innerHeight}
        appName="基于邮编的物流可视化系统"
        version="v1"
      />
    </div>
  );
};

export default LogisticsMap;