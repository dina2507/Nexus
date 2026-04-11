import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

const StadiumMap = ({ crowdDensity = {} }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const polygonsRef = useRef({});
  const [mapMode, setMapMode] = useState('loading');
  const [mapError, setMapError] = useState('');
  const [selectedZone, setSelectedZone] = useState(null);

  const densityToColor = (pct) => {
    if (pct < 0.70) return '#639922';
    if (pct >= 0.70 && pct <= 0.85) return '#EF9F27';
    if (pct > 0.85 && pct <= 0.93) return '#E24B4A';
    if (pct > 0.93) return '#A32D2D';
    return '#639922';
  };

  const zonesData = {
    'north_stand': [{lat:13.0641,lng:80.2783},{lat:13.0644,lng:80.2798},{lat:13.0638,lng:80.2800},{lat:13.0635,lng:80.2785}],
    'south_stand': [{lat:13.0621,lng:80.2783},{lat:13.0624,lng:80.2798},{lat:13.0618,lng:80.2800},{lat:13.0615,lng:80.2785}],
    'east_block': [{lat:13.0628,lng:80.2798},{lat:13.0638,lng:80.2800},{lat:13.0638,lng:80.2808},{lat:13.0628,lng:80.2806}],
    'west_block': [{lat:13.0628,lng:80.2775},{lat:13.0638,lng:80.2775},{lat:13.0638,lng:80.2783},{lat:13.0628,lng:80.2783}],
    'concourse_a': [{lat:13.0635,lng:80.2787},{lat:13.0638,lng:80.2795},{lat:13.0633,lng:80.2796},{lat:13.0630,lng:80.2788}]
  };

  const fallbackPolygons = useMemo(() => {
    const coords = Object.values(zonesData).flat();
    const lats = coords.map(point => point.lat);
    const lngs = coords.map(point => point.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const toPoint = ({ lat, lng }) => {
      const x = ((lng - minLng) / (maxLng - minLng || 1)) * 100;
      const y = 100 - ((lat - minLat) / (maxLat - minLat || 1)) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    };

    return Object.entries(zonesData).map(([zoneId, points]) => ({
      zoneId,
      points: points.map(toPoint).join(' '),
    }));
  }, []);

  useEffect(() => {
    const apiKey = (import.meta.env.VITE_MAPS_KEY || '').trim();

    if (!apiKey) {
      setMapError('VITE_MAPS_KEY is empty.');
      setMapMode('fallback');
      return undefined;
    }

    const loader = new Loader({
      apiKey,
      version: 'weekly',
    });

    loader.load().then((google) => {
      if (!mapInstance.current && mapRef.current) {
        setMapMode('google');
        mapInstance.current = new google.maps.Map(mapRef.current, {
          center: { lat: 13.0631, lng: 80.2790 },
          zoom: 17,
          mapTypeId: 'satellite',
          disableDefaultUI: true,
        });

        const infoWindow = new google.maps.InfoWindow();

        Object.keys(zonesData).forEach(zoneId => {
          const polygon = new google.maps.Polygon({
            paths: zonesData[zoneId],
            strokeColor: 'white',
            strokeWeight: 1.5,
            fillColor: '#639922',
            fillOpacity: 0.5,
            map: mapInstance.current
          });

          polygon.addListener('click', (event) => {
            const currentPct = crowdDensity[zoneId] !== undefined ? crowdDensity[zoneId] : 0;
            infoWindow.setContent(`<b>${zoneId}</b><br/>Density: ${(currentPct * 100).toFixed(1)}%`);
            infoWindow.setPosition(event.latLng);
            infoWindow.open(mapInstance.current);
          });

          polygonsRef.current[zoneId] = polygon;
        });
      }
    }).catch((e) => {
      console.error('Error loading Google Maps API', e);
      setMapError(String(e?.message || e || 'Unknown Google Maps error'));
      setMapMode('fallback');
    });

    return () => {
      polygonsRef.current = {};
    };
  }, []); // eslint-disable-next-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mapInstance.current) {
      Object.keys(polygonsRef.current).forEach(zoneId => {
        const pct = crowdDensity[zoneId] !== undefined ? crowdDensity[zoneId] : 0;
        const color = densityToColor(pct);
        polygonsRef.current[zoneId].setOptions({ fillColor: color });
      });
    }
  }, [crowdDensity]);

  if (mapMode === 'fallback') {
    const activeZone = selectedZone
      ? {
          id: selectedZone,
          pct: crowdDensity[selectedZone] ?? 0,
        }
      : null;

    return (
      <div style={{ width: '100%', minHeight: '300px', borderRadius: '8px', overflow: 'hidden', background: 'linear-gradient(180deg, #08111f 0%, #050505 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <div style={{ color: '#00f3ff', fontSize: '10px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase' }}>Live Map Fallback</div>
            <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>Chepauk zone heatmap without Google Maps</div>
            {mapError ? (
              <div style={{ color: '#fca5a5', fontSize: '11px', marginTop: '4px', maxWidth: '620px' }}>
                {mapError}
              </div>
            ) : null}
          </div>
          <div style={{ color: '#EF9F27', fontSize: '10px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>Static overlay</div>
        </div>

        <div style={{ position: 'relative', padding: '12px' }}>
          <svg viewBox="0 0 100 100" width="100%" height="260" role="img" aria-label="Chepauk stadium zones fallback map" style={{ display: 'block' }}>
            <defs>
              <linearGradient id="stadium-bg" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#020617" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="100" height="100" rx="6" fill="url(#stadium-bg)" />
            {fallbackPolygons.map(({ zoneId, points }) => {
              const pct = crowdDensity[zoneId] ?? 0;
              const fill = densityToColor(pct);
              const isSelected = selectedZone === zoneId;
              return (
                <polygon
                  key={zoneId}
                  points={points}
                  fill={fill}
                  fillOpacity={isSelected ? 0.92 : 0.68}
                  stroke={isSelected ? '#ffffff' : 'rgba(255,255,255,0.55)'}
                  strokeWidth={isSelected ? 0.9 : 0.5}
                  style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                  onClick={() => setSelectedZone(zoneId)}
                />
              );
            })}
            <circle cx="50" cy="50" r="7" fill="#050505" stroke="#00f3ff" strokeWidth="0.8" />
            <text x="50" y="53.5" textAnchor="middle" fontSize="3.2" fill="#e2e8f0" fontWeight="700">PITCH</text>
          </svg>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginTop: '12px' }}>
            {Object.keys(zonesData).map(zoneId => {
              const pct = crowdDensity[zoneId] ?? 0;
              return (
                <button
                  key={zoneId}
                  onClick={() => setSelectedZone(zoneId)}
                  style={{
                    background: selectedZone === zoneId ? 'rgba(0,243,255,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selectedZone === zoneId ? 'rgba(0,243,255,0.35)' : 'rgba(255,255,255,0.06)'}`,
                    color: 'white',
                    borderRadius: '10px',
                    padding: '10px 8px',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
                    {zoneId.replace('_', ' ')}
                  </div>
                  <div style={{ marginTop: '2px', fontSize: '14px', fontWeight: 800, color: densityToColor(pct) }}>
                    {(pct * 100).toFixed(1)}%
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {activeZone ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                <div>
                  <div style={{ color: 'white', fontSize: '13px', fontWeight: 800, textTransform: 'capitalize' }}>{activeZone.id.replace('_', ' ')}</div>
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>Density updates in real time from Firestore</div>
                </div>
                <div style={{ color: densityToColor(activeZone.pct), fontWeight: 900, fontSize: '18px' }}>
                  {(activeZone.pct * 100).toFixed(1)}%
                </div>
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '12px' }}>Click any zone to inspect density and colour status.</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: '300px', borderRadius: '8px', overflow: 'hidden' }} />;
};

export default StadiumMap;
