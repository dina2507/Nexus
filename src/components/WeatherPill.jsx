import { useNexus } from '../context/NexusContext';
import { Cloud, Sun, CloudRain } from 'lucide-react';

export default function WeatherPill() {
  const { weatherData } = useNexus();

  if (!weatherData) return null;

  let Icon = Sun;
  let color = 'var(--warning)'; // yellow/sun
  if (weatherData.condition === 'cloudy') {
    Icon = Cloud;
    color = 'var(--text-muted)';
  } else if (weatherData.condition === 'rain' || weatherData.precip_mm > 0) {
    Icon = CloudRain;
    color = 'var(--accent)';
  }

  return (
    <div style={{ 
      display: 'flex', alignItems: 'center', gap: '6px', 
      padding: '4px 8px', background: 'rgba(255,255,255,0.04)', 
      borderRadius: '6px', border: '1px solid var(--border-subtle)',
      flexShrink: 0
    }}>
      <Icon size={12} style={{ color }} />
      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
        {weatherData.temp_c}°C
      </span>
      {weatherData.precip_mm > 0 && (
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          {weatherData.precip_mm}mm
        </span>
      )}
    </div>
  );
}
