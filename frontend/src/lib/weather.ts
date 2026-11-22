export interface WeatherPlace {
  name: string;
  state: string;
  lat: number;
  lng: number;
}

interface WeatherSource {
  source: string;
  retrieved_at: string;
  stale: boolean;
}

interface CurrentWeather {
  time: string;
  temperature_2m: number | null;
  wind_speed_10m: number | null;
}

export interface ForecastHour {
  time: string;
  precipitation: number | null;
  precipitation_probability: number | null;
  wind_gusts_10m: number | null;
}

export interface ForecastDay {
  time: string;
  precipitation_sum: number | null;
  precipitation_probability_max: number | null;
  wind_gusts_10m_max: number | null;
  temperature_2m_min: number | null;
  temperature_2m_max: number | null;
}

export interface FieldForecast extends WeatherSource {
  current: CurrentWeather;
  hourly: ForecastHour[];
  daily: ForecastDay[];
}

export interface IndiaWeather extends WeatherSource {
  locations: (WeatherPlace & { current: CurrentWeather; daily: ForecastDay })[];
}

export const IMD_WARNINGS = "https://mausam.imd.gov.in/responsive/districtWiseWarningGIS.php";
export const IMD_AGROMET = "https://mausam.imd.gov.in/responsive/agromet_adv_ser_state_current.php";

export function displayWeather(value: number | null, unit: string) {
  return value === null ? "—" : `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}${unit}`;
}

const HOUR = 60 * 60 * 1000;

function hourEnding(time: string) {
  return Date.parse(`${time}+05:30`);
}

export function upcomingHours(forecast: FieldForecast, now: number, hours: number) {
  return forecast.hourly.filter(({ time }) => {
    const end = hourEnding(time);
    return end - HOUR >= now && end <= now + hours * HOUR;
  });
}

export function fieldWindow(hours: ForecastHour[], duration: number, gustLimit: number) {
  let consecutive: ForecastHour[] = [];
  for (const hour of hours) {
    const hourOfDay = Number(hour.time.slice(11, 13));
    const usable = hourOfDay >= 8 && hourOfDay <= 18 && hour.precipitation === 0
      && hour.precipitation_probability !== null && hour.precipitation_probability <= 25
      && hour.wind_gusts_10m !== null && hour.wind_gusts_10m <= gustLimit;
    if (!usable) {
      consecutive = [];
      continue;
    }
    const last = consecutive.at(-1);
    if (last && hourEnding(hour.time) - hourEnding(last.time) !== HOUR) consecutive = [];
    consecutive.push(hour);
    if (consecutive.length === duration) {
      return {
        start: hourEnding(consecutive[0].time) - HOUR,
        end: hourEnding(hour.time),
        rain: Math.max(...consecutive.map((item) => item.precipitation_probability ?? 0)),
        gust: Math.max(...consecutive.map((item) => item.wind_gusts_10m ?? 0)),
      };
    }
  }
  return undefined;
}
