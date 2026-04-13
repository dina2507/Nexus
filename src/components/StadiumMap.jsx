import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

// Proper stadium overhead layout — fixed coordinates in 400×280 viewBox
const STADIUM_ZONES = {
  north_stand:  { points: '80,8  320,8  296,88  104,88',   cx: 200, cy: 48,  label: 'North Stand'  },
  south_stand:  { points: '104,192 296,192 320,272 80,272', cx: 200, cy: 232, label: 'South Stand'  },
  east_block:   { points: '296,88 380,52 380,228 296,192',  cx: 346, cy: 140, label: 'East Block'   },
  west_block:   { points: '20,52  104,88  104,192 20,228',  cx: 54,  cy: 140, label: 'West Block'   },
  concourse_a:  { points: '104,88 296,88  296,192 104,192', cx: 200, cy: 140, label: 'Concourse A'  },
};

const densityToColor = (pct) => {
  if (pct >= 0.93) return '#dc2626';
  if (pct >= 0.82) return '#ef4444';
  if (pct >= 0.70) return '#f59e0b';
  return '#10b981';
};

const densityToFill = (pct) => {
  if (pct >= 0.93) return 'rgba(220,38,38,0.35)';
  if (pct >= 0.82) return 'rgba(239,68,68,0.28)';
  if (pct >= 0.70) return 'rgba(245,158,11,0.22)';
  return 'rgba(16,185,129,0.18)';
};

const StadiumMap = ({ crowdDensity = {} }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const polygonsRef = useRef({});
  const [mapMode, setMapMode] = useState('loading');
  const [mapError, setMapError] = useState('');
  const [selectedZone, setSelectedZone] = useState(null);

  const zonesData = {
    'north_stand': [{lat:13.0641,lng:80.2783},{lat:13.0644,lng:80.2798},{lat:13.0638,lng:80.2800},{lat:13.0635,lng:80.2785}],
    'south_stand': [{lat:13.0621,lng:80.2783},{lat:13.0624,lng:80.2798},{lat:13.0618,lng:80.2800},{lat:13.0615,lng:80.2785}],
    'east_block':  [{lat:13.0628,lng:80.2798},{lat:13.0638,lng:80.2800},{lat:13.0638,lng:80.2808},{lat:13.0628,lng:80.2806}],
    'west_block':  [{lat:13.0628,lng:80.2775},{lat:13.0638,lng:80.2775},{lat:13.0638,lng:80.2783},{lat:13.0628,lng:80.2783}],
    'concourse_a': [{lat:13.0635,lng:80.2787},{lat:13.0638,lng:80.2795},{lat:13.0633,lng:80.2796},{lat:13.0630,lng:80.2788}],
  };

  useEffect(() => {
    const apiKey = (import.meta.env.VITE_MAPS_KEY || '').trim();

    if (!apiKey) {
      setMapError('VITE_MAPS_KEY not set');
      setMapMode('fallback');
      return undefined;
    }

    window.gm_authFailure = () => {
      setMapError('Maps API auth failed');
      setMapMode('fallback');
    };

    const loader = new Loader({ apiKey, version: 'weekly' });

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
            fillColor: '#10b981',
            fillOpacity: 0.45,
            map: mapInstance.current,
          });

          polygon.addListener('click', (event) => {
            const pct = crowdDensity[zoneId] ?? 0;
            infoWindow.setContent(`<b style="font-family:Outfit,sans-serif">${zoneId.replace(/_/g,' ')}</b><br/>Density: ${(pct*100).toFixed(1)}%`);
            infoWindow.setPosition(event.latLng);
            infoWindow.open(mapInstance.current);
          });

          polygonsRef.current[zoneId] = polygon;
        });
      }
    }).catch((e) => {
      const msg = String(e?.message || e || '');
      let hint = 'Maps API unavailable';
      if (msg.includes('ApiTargetBlocked')) hint = 'API key referrer restriction';
      else if (msg.includes('InvalidKey'))  hint = 'Invalid Maps API key';
      else if (msg.includes('MissingKey'))  hint = 'No Maps API key set';
      setMapError(hint);
      setMapMode('fallback');
    });

    return () => {
      window.gm_authFailure = undefined;
      Object.values(polygonsRef.current).forEach(p => { try { p.setMap(null); } catch (_) {} });
      polygonsRef.current = {};
      mapInstance.current = null;
    };
  }, []); // eslint-disable-next-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mapInstance.current) {
      Object.keys(polygonsRef.current).forEach(zoneId => {
        const pct = crowdDensity[zoneId] ?? 0;
        polygonsRef.current[zoneId].setOptions({ fillColor: densityToColor(pct) });
      });
    }
  }, [crowdDensity]);

  /* ─── SVG Fallback ─── */
  if (mapMode === 'fallback') {
    return (
      <div style={{ width: '100%', background: '#0d1526', borderRadius: '12px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div>
            <span className="section-label">Chepauk Zone Heatmap</span>
            {mapError && (
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px' }}>
                SVG mode — {mapError}
              </div>
            )}
          </div>
          <span className="badge badge-slate">SVG</span>
        </div>

        {/* SVG stadium view */}
        <div style={{ padding: '16px 16px 8px' }}>
          <svg viewBox="0 0 400 280" width="100%" style={{ display: 'block' }}>
            <defs>
              <radialGradient id="field-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#1a3a1a" />
                <stop offset="100%" stopColor="#0d1a0d" />
              </radialGradient>
            </defs>

            {/* Stadium outer background */}
            <rect x="0" y="0" width="400" height="280" fill="#0d1526" />

            {/* Zone polygons */}
            {Object.entries(STADIUM_ZONES).map(([zoneId, zone]) => {
              const pct = crowdDensity[zoneId] ?? 0;
              const isSelected = selectedZone === zoneId;
              return (
                <g key={zoneId}
                  onClick={() => setSelectedZone(isSelected ? null : zoneId)}
                  style={{ cursor: 'pointer' }}>
                  <polygon
                    points={zone.points}
                    fill={densityToFill(pct)}
                    stroke={isSelected ? '#3b82f6' : densityToColor(pct)}
                    strokeWidth={isSelected ? 2 : 0.8}
                    strokeOpacity={isSelected ? 1 : 0.5}
                    style={{ transition: 'fill 0.4s ease, stroke 0.2s ease' }}
                  />
                  {/* Density % label */}
                  <text
                    x={zone.cx} y={zone.cy - 4}
                    textAnchor="middle"
                    fontSize="13" fontWeight="700"
                    fill={densityToColor(pct)}
                    fontFamily="Outfit,sans-serif"
                    style={{ pointerEvents: 'none' }}
                  >
                    {(pct * 100).toFixed(0)}%
                  </text>
                  {/* Zone name label */}
                  <text
                    x={zone.cx} y={zone.cy + 11}
                    textAnchor="middle"
                    fontSize="8" fontWeight="500"
                    fill="rgba(255,255,255,0.30)"
                    fontFamily="Outfit,sans-serif"
                    style={{ pointerEvents: 'none' }}
                  >
                    {zone.label.toUpperCase()}
                  </text>
                </g>
              );
            })}

            {/* Playing field */}
            <rect x="104" y="88" width="192" height="104" fill="url(#field-grad)" rx="4" />
            {/* Pitch */}
            <rect x="166" y="112" width="68" height="56" fill="none"
              stroke="rgba(255,255,255,0.12)" strokeWidth="1" rx="2" />
            <text x="200" y="144" textAnchor="middle" fontSize="9"
              fill="rgba(255,255,255,0.30)" fontWeight="600" fontFamily="Outfit,sans-serif">
              PITCH
            </text>
          </svg>
        </div>

        {/* Zone buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '6px', padding: '0 16px 16px' }}>
          {Object.entries(STADIUM_ZONES).map(([zoneId, zone]) => {
            const pct = crowdDensity[zoneId] ?? 0;
            const isSelected = selectedZone === zoneId;
            return (
              <button
                key={zoneId}
                onClick={() => setSelectedZone(isSelected ? null : zoneId)}
                style={{
                  background: isSelected ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isSelected ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: '8px', padding: '8px 6px', textAlign: 'center',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: '9px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  {zone.label}
                </div>
                <div style={{ marginTop: '3px', fontSize: '14px', fontWeight: 700,
                  color: densityToColor(pct), fontVariantNumeric: 'tabular-nums' }}>
                  {(pct * 100).toFixed(0)}%
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ─── Loading state ─── */
  if (mapMode === 'loading') {
    return (
      <div style={{ width: '100%', minHeight: '300px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0d1526', borderRadius: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '24px', height: '24px', borderRadius: '50%',
            border: '2px solid rgba(59,130,246,0.25)', borderTopColor: '#3b82f6',
            animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: '11px', color: '#475569', letterSpacing: '0.04em' }}>Loading map…</span>
        </div>
      </div>
    );
  }

  /* ─── Google Maps ─── */
  return (
    <div ref={mapRef}
      style={{ width: '100%', height: '100%', minHeight: '300px', borderRadius: '12px', overflow: 'hidden' }} />
  );
};

export default StadiumMap;
