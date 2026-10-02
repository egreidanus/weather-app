const LOCALE = "en-GB";

const BACKGROUNDS = Object.freeze({
  sunny: { image: "images/backgrounds/sunny_weather.jpg", seed: "#e8a33d" },
  cloudy: { image: "images/backgrounds/cloudy_weather.jpg", seed: "#7d8fa3" },
  rainy: { image: "images/backgrounds/rainy_weather.jpg", seed: "#4a6f93" },
  snowy: { image: "images/backgrounds/snowy_weather.jpg", seed: "#8fb3cf" },
  thunder: { image: "images/backgrounds/thunder_weather.jpg", seed: "#5b5476" }
});

const WEATHER_CONDITIONS = Object.freeze({
  sunny: { label: "Sunny", icon: { day: "sunny", night: "clear_night" }, background: BACKGROUNDS.sunny },
  partlyCloudy: { label: "Partly cloudy", icon: { day: "partly_cloudy_day", night: "partly_cloudy_night" }, background: BACKGROUNDS.cloudy },
  cloudy: { label: "Cloudy", icon: { day: "cloud", night: "cloud" }, background: BACKGROUNDS.cloudy },
  foggy: { label: "Foggy", icon: { day: "foggy", night: "foggy" }, background: BACKGROUNDS.cloudy },
  drizzle: { label: "Drizzle", icon: { day: "rainy_light", night: "rainy_light" }, background: BACKGROUNDS.rainy },
  rainy: { label: "Rainy", icon: { day: "rainy", night: "rainy" }, background: BACKGROUNDS.rainy },
  snowy: { label: "Snowy", icon: { day: "weather_snowy", night: "weather_snowy" }, background: BACKGROUNDS.snowy },
  thunderstorm: { label: "Thunderstorm", icon: { day: "thunderstorm", night: "thunderstorm" }, background: BACKGROUNDS.thunder }
});

const WEATHER_CODES = Object.freeze({
  0: { condition: "sunny", description: "Clear sky" },
  1: { condition: "sunny", description: "Mainly clear" },
  2: { condition: "partlyCloudy", description: "Partly cloudy" },
  3: { condition: "cloudy", description: "Overcast" },
  45: { condition: "foggy", description: "Fog" },
  48: { condition: "foggy", description: "Depositing rime fog" },
  51: { condition: "drizzle", description: "Light drizzle" },
  53: { condition: "drizzle", description: "Moderate drizzle" },
  55: { condition: "drizzle", description: "Dense drizzle" },
  56: { condition: "drizzle", description: "Light freezing drizzle" },
  57: { condition: "drizzle", description: "Dense freezing drizzle" },
  61: { condition: "rainy", description: "Light rain" },
  63: { condition: "rainy", description: "Moderate rain" },
  65: { condition: "rainy", description: "Heavy rain" },
  66: { condition: "rainy", description: "Light freezing rain" },
  67: { condition: "rainy", description: "Heavy freezing rain" },
  71: { condition: "snowy", description: "Light snowfall" },
  73: { condition: "snowy", description: "Moderate snowfall" },
  75: { condition: "snowy", description: "Heavy snowfall" },
  77: { condition: "snowy", description: "Snow grains" },
  80: { condition: "rainy", description: "Light rain showers" },
  81: { condition: "rainy", description: "Moderate rain showers" },
  82: { condition: "rainy", description: "Violent rain showers" },
  85: { condition: "snowy", description: "Light snow showers" },
  86: { condition: "snowy", description: "Heavy snow showers" },
  95: { condition: "thunderstorm", description: "Thunderstorm" },
  96: { condition: "thunderstorm", description: "Thunderstorm with light hail" },
  99: { condition: "thunderstorm", description: "Thunderstorm with heavy hail" }
});

const COMPASS_DIRECTIONS = Object.freeze(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);

const weatherInterpreter = (function () {
  const FALLBACK = { condition: "cloudy", description: "Unknown" };

  function describe(code, isDay = true) {
    const entry = WEATHER_CODES[code] ?? FALLBACK;
    const condition = WEATHER_CONDITIONS[entry.condition];

    return {
      code,
      condition: entry.condition,
      label: condition.label,
      description: entry.description,
      icon: isDay ? condition.icon.day : condition.icon.night,
      background: condition.background.image,
      seed: condition.background.seed
    };
  }

  function toCompassDirection(degrees) {
    if (typeof degrees !== "number") {
      return null;
    }
    return COMPASS_DIRECTIONS[Math.round(degrees / 45) % COMPASS_DIRECTIONS.length];
  }

  return {
    describe,
    toCompassDirection
  };
})();

const locationService = (function () {
  const UNKNOWN_LOCATION = "Unknown location";

  let position = null;
  let cityCache = { key: null, name: null };

  async function init() {
    if (!("geolocation" in navigator)) {
      console.error("navigator.geolocation is not available in your browser.");
      return;
    }

    try {
      position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000
        });
      });
    } catch (error) {
      console.error("Error while retrieving location:", error);
    }
  }

  function getCoords() {
    if (position === null) {
      return null;
    }

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    };
  }

  async function getCityName() {
    const coords = getCoords();

    if (coords === null) {
      return UNKNOWN_LOCATION;
    }

    const cacheKey = `${coords.latitude.toFixed(2)},${coords.longitude.toFixed(2)}`;

    if (cityCache.key === cacheKey) {
      return cityCache.name;
    }

    const params = new URLSearchParams({
      latitude: coords.latitude,
      longitude: coords.longitude,
      localityLanguage: "nl"
    });

    try {
      const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`);

      if (!response.ok) {
        throw new Error(`Reverse geocoding responded with status ${response.status}`);
      }

      const data = await response.json();
      const name = data.city || data.locality || UNKNOWN_LOCATION;
      cityCache = { key: cacheKey, name };
      return name;
    } catch (error) {
      console.error("Error while retrieving city name:", error);
      return UNKNOWN_LOCATION;
    }
  }

  return {
    init,
    getCoords,
    getCityName
  };
})();

const weatherService = (function () {
  const API_URL = "https://api.open-meteo.com/v1/forecast";
  const FORECAST_DAYS = 7;

  const CURRENT_FIELDS = [
    "temperature_2m",
    "apparent_temperature",
    "relative_humidity_2m",
    "dew_point_2m",
    "is_day",
    "precipitation",
    "rain",
    "showers",
    "snowfall",
    "weather_code",
    "cloud_cover",
    "pressure_msl",
    "visibility",
    "uv_index",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m"
  ];

  const HOURLY_FIELDS = [
    "temperature_2m",
    "apparent_temperature",
    "relative_humidity_2m",
    "precipitation_probability",
    "precipitation",
    "weather_code",
    "cloud_cover",
    "visibility",
    "uv_index",
    "wind_speed_10m",
    "wind_direction_10m",
    "is_day"
  ];

  const DAILY_FIELDS = [
    "weather_code",
    "temperature_2m_max",
    "temperature_2m_min",
    "apparent_temperature_max",
    "apparent_temperature_min",
    "sunrise",
    "sunset",
    "daylight_duration",
    "sunshine_duration",
    "uv_index_max",
    "precipitation_sum",
    "precipitation_hours",
    "precipitation_probability_max",
    "wind_speed_10m_max",
    "wind_gusts_10m_max",
    "wind_direction_10m_dominant"
  ];

  async function fetchForecast(latitude, longitude) {
    const params = new URLSearchParams({
      latitude,
      longitude,
      current: CURRENT_FIELDS.join(","),
      hourly: HOURLY_FIELDS.join(","),
      daily: DAILY_FIELDS.join(","),
      timezone: "auto",
      forecast_days: FORECAST_DAYS
    });

    const response = await fetch(`${API_URL}?${params}`);

    if (!response.ok) {
      throw new Error(`Weather API responded with status ${response.status}`);
    }

    return response.json();
  }

  function mapUnits(units) {
    return {
      temperature: units.temperature_2m,
      humidity: units.relative_humidity_2m,
      precipitation: units.precipitation,
      snowfall: units.snowfall,
      cloudCover: units.cloud_cover,
      pressure: units.pressure_msl,
      visibility: units.visibility,
      windSpeed: units.wind_speed_10m,
      windDirection: units.wind_direction_10m
    };
  }

  function mapCurrent(current) {
    const isDay = current.is_day === 1;

    return {
      time: current.time,
      isDay,
      temperature: current.temperature_2m,
      apparentTemperature: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      dewPoint: current.dew_point_2m,
      precipitation: current.precipitation,
      rain: current.rain,
      showers: current.showers,
      snowfall: current.snowfall,
      cloudCover: current.cloud_cover,
      pressure: current.pressure_msl,
      visibility: current.visibility,
      uvIndex: current.uv_index,
      windSpeed: current.wind_speed_10m,
      windDirection: current.wind_direction_10m,
      windCompass: weatherInterpreter.toCompassDirection(current.wind_direction_10m),
      windGusts: current.wind_gusts_10m,
      weather: weatherInterpreter.describe(current.weather_code, isDay)
    };
  }

  function mapHourly(hourly) {
    return hourly.time.map((time, index) => {
      const isDay = hourly.is_day[index] === 1;

      return {
        time,
        date: time.slice(0, 10),
        hour: time.slice(11, 16),
        isDay,
        temperature: hourly.temperature_2m[index],
        apparentTemperature: hourly.apparent_temperature[index],
        humidity: hourly.relative_humidity_2m[index],
        precipitationProbability: hourly.precipitation_probability[index],
        precipitation: hourly.precipitation[index],
        cloudCover: hourly.cloud_cover[index],
        visibility: hourly.visibility[index],
        uvIndex: hourly.uv_index[index],
        windSpeed: hourly.wind_speed_10m[index],
        windDirection: hourly.wind_direction_10m[index],
        windCompass: weatherInterpreter.toCompassDirection(hourly.wind_direction_10m[index]),
        weather: weatherInterpreter.describe(hourly.weather_code[index], isDay)
      };
    });
  }

  function mapDaily(daily) {
    return daily.time.map((date, index) => ({
      date,
      temperatureMax: daily.temperature_2m_max[index],
      temperatureMin: daily.temperature_2m_min[index],
      apparentTemperatureMax: daily.apparent_temperature_max[index],
      apparentTemperatureMin: daily.apparent_temperature_min[index],
      sunrise: daily.sunrise[index],
      sunset: daily.sunset[index],
      daylightDuration: daily.daylight_duration[index],
      sunshineDuration: daily.sunshine_duration[index],
      uvIndexMax: daily.uv_index_max[index],
      precipitationSum: daily.precipitation_sum[index],
      precipitationHours: daily.precipitation_hours[index],
      precipitationProbabilityMax: daily.precipitation_probability_max[index],
      windSpeedMax: daily.wind_speed_10m_max[index],
      windGustsMax: daily.wind_gusts_10m_max[index],
      windDirectionDominant: daily.wind_direction_10m_dominant[index],
      windCompass: weatherInterpreter.toCompassDirection(daily.wind_direction_10m_dominant[index]),
      weather: weatherInterpreter.describe(daily.weather_code[index], true)
    }));
  }

  async function getForecast(latitude, longitude) {
    const data = await fetchForecast(latitude, longitude);

    return {
      timezone: data.timezone,
      utcOffsetSeconds: data.utc_offset_seconds,
      units: mapUnits(data.current_units),
      current: mapCurrent(data.current),
      hourly: mapHourly(data.hourly),
      daily: mapDaily(data.daily)
    };
  }

  return {
    getForecast
  };
})();

const clockService = (function () {
  const TICK_INTERVAL_MS = 1000;

  const listeners = new Set();
  let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let timerId = null;

  function format(date, options, zone = timezone) {
    return new Intl.DateTimeFormat(LOCALE, { timeZone: zone, ...options }).format(date);
  }

  function setTimezone(value) {
    if (value && value !== timezone) {
      timezone = value;
      notify();
    }
  }

  function getTimezone() {
    return timezone;
  }

  function now() {
    const date = new Date();

    return {
      date,
      timezone,
      time: formatTime(date),
      timeWithSeconds: format(date, { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      weekday: format(date, { weekday: "long" }),
      shortDate: format(date, { day: "numeric", month: "short" }),
      fullDate: format(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    };
  }

  function nowIso() {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }).formatToParts(new Date()).map((part) => [part.type, part.value])
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }

  function minutesBetween(fromIso, toIso) {
    return Math.round((Date.parse(`${toIso}:00Z`) - Date.parse(`${fromIso}:00Z`)) / 60000);
  }

  function formatTime(date) {
    return format(date, { hour: "2-digit", minute: "2-digit" });
  }

  function formatForecastHour(isoDateTime) {
    return isoDateTime.slice(11, 16);
  }

  function formatForecastDay(isoDate, options = { weekday: "long" }) {
    return format(new Date(`${isoDate}T00:00:00Z`), options, "UTC");
  }

  function formatDuration(seconds) {
    const totalMinutes = Math.round(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  function notify() {
    const snapshot = now();
    listeners.forEach((listener) => listener(snapshot));
  }

  function subscribe(listener) {
    listeners.add(listener);
    listener(now());

    if (timerId === null) {
      timerId = setInterval(notify, TICK_INTERVAL_MS);
    }

    return function unsubscribe() {
      listeners.delete(listener);

      if (listeners.size === 0 && timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
    };
  }

  return {
    now,
    nowIso,
    minutesBetween,
    subscribe,
    setTimezone,
    getTimezone,
    formatTime,
    formatForecastHour,
    formatForecastDay,
    formatDuration
  };
})();

const themeService = (function () {
  const LIBRARY_URL = "https://cdn.jsdelivr.net/npm/@material/material-color-utilities@0.4.0/+esm";

  const COLOR_ROLES = [
    "primary",
    "onPrimary",
    "primaryContainer",
    "onPrimaryContainer",
    "secondary",
    "onSecondary",
    "secondaryContainer",
    "onSecondaryContainer",
    "tertiary",
    "onTertiary",
    "tertiaryContainer",
    "onTertiaryContainer",
    "error",
    "onError",
    "errorContainer",
    "onErrorContainer",
    "surface",
    "onSurface",
    "surfaceVariant",
    "onSurfaceVariant",
    "surfaceContainerLowest",
    "surfaceContainerLow",
    "surfaceContainer",
    "surfaceContainerHigh",
    "surfaceContainerHighest",
    "outline",
    "outlineVariant",
    "inverseSurface",
    "inverseOnSurface",
    "inversePrimary",
    "scrim",
    "shadow"
  ];

  const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const sourceColorCache = new Map();

  let libraryPromise = null;
  let activeSource = null;

  function loadLibrary() {
    libraryPromise ??= import(LIBRARY_URL).catch((error) => {
      libraryPromise = null;
      throw error;
    });
    return libraryPromise;
  }

  function toCustomProperty(role) {
    return `--md-sys-color-${role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
  }

  async function resolveSourceColor(library, weather) {
    if (sourceColorCache.has(weather.background)) {
      return sourceColorCache.get(weather.background);
    }

    let sourceColor;

    try {
      const image = new Image();
      image.src = weather.background;
      await image.decode();
      sourceColor = await library.sourceColorFromImage(image);
    } catch (error) {
      sourceColor = library.argbFromHex(weather.seed);
    }

    sourceColorCache.set(weather.background, sourceColor);
    return sourceColor;
  }

  function paint(library, sourceColor) {
    const isDark = darkModeQuery.matches;
    const scheme = new library.SchemeTonalSpot(library.Hct.fromInt(sourceColor), isDark, 0);
    const rootStyle = document.documentElement.style;

    COLOR_ROLES.forEach((role) => {
      rootStyle.setProperty(toCustomProperty(role), library.hexFromArgb(library.MaterialDynamicColors[role].getArgb(scheme)));
    });

    document.querySelector("meta[name='theme-color']")?.setAttribute(
      "content",
      library.hexFromArgb(library.MaterialDynamicColors.surface.getArgb(scheme))
    );
  }

  async function apply(weather) {
    try {
      const library = await loadLibrary();
      activeSource = await resolveSourceColor(library, weather);
      paint(library, activeSource);
    } catch (error) {
      console.error("Error while generating the dynamic color theme:", error);
    }
  }

  darkModeQuery.addEventListener("change", async () => {
    if (activeSource !== null) {
      paint(await loadLibrary(), activeSource);
    }
  });

  return {
    apply
  };
})();

const backgroundService = (function () {
  let activeBackground = null;

  function preload() {
    Object.values(BACKGROUNDS).forEach(({ image }) => {
      const preloader = new Image();
      preloader.src = image;
    });
  }

  function apply(weather) {
    if (!weather || weather.background === activeBackground) {
      return;
    }

    activeBackground = weather.background;
    document.documentElement.style.setProperty("--weather-image", `url("${weather.background}")`);
    document.body.dataset.weather = weather.condition;
    themeService.apply(weather);
  }

  return {
    preload,
    apply
  };
})();

const weatherStore = (function () {
  const listeners = new Set();

  let state = {
    status: "idle",
    error: null,
    lastUpdated: null,
    location: { latitude: null, longitude: null, cityName: null },
    forecast: null
  };

  function getState() {
    return state;
  }

  function setState(partial) {
    state = { ...state, ...partial };
    listeners.forEach((listener) => listener(state));
  }

  function subscribe(listener) {
    listeners.add(listener);
    return function unsubscribe() {
      listeners.delete(listener);
    };
  }

  return {
    getState,
    setState,
    subscribe
  };
})();

const weatherApp = (function () {
  const AUTO_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

  let pendingRefresh = null;
  let autoRefreshId = null;

  async function resolveCoords() {
    let coords = locationService.getCoords();

    if (coords === null) {
      await locationService.init();
      coords = locationService.getCoords();
    }

    return coords;
  }

  async function performRefresh() {
    weatherStore.setState({ status: "loading", error: null });

    try {
      const coords = await resolveCoords();

      if (coords === null) {
        throw new Error("Location is unavailable.");
      }

      const [forecast, cityName] = await Promise.all([
        weatherService.getForecast(coords.latitude, coords.longitude),
        locationService.getCityName()
      ]);

      clockService.setTimezone(forecast.timezone);

      weatherStore.setState({
        status: "ready",
        lastUpdated: new Date(),
        location: { ...coords, cityName },
        forecast
      });
    } catch (error) {
      console.error("Error while refreshing weather data:", error);
      weatherStore.setState({ status: "error", error });
    }

    return weatherStore.getState();
  }

  function refresh() {
    if (pendingRefresh === null) {
      pendingRefresh = performRefresh().finally(() => {
        pendingRefresh = null;
      });
    }

    return pendingRefresh;
  }

  function bindRefreshButton(button, onComplete) {
    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");

      try {
        const state = await refresh();
        onComplete?.(state);
      } finally {
        button.disabled = false;
        button.removeAttribute("aria-busy");
      }
    });
  }

  function startAutoRefresh(interval = AUTO_REFRESH_INTERVAL_MS) {
    stopAutoRefresh();
    autoRefreshId = setInterval(refresh, interval);
  }

  function stopAutoRefresh() {
    if (autoRefreshId !== null) {
      clearInterval(autoRefreshId);
      autoRefreshId = null;
    }
  }

  function getForecast() {
    return weatherStore.getState().forecast;
  }

  function getCurrent() {
    return getForecast()?.current ?? null;
  }

  function getUnits() {
    return getForecast()?.units ?? null;
  }

  function getHourlyForDate(date) {
    return getForecast()?.hourly.filter((hour) => hour.date === date) ?? [];
  }

  function getTodayHourly() {
    const current = getCurrent();
    return current ? getHourlyForDate(current.time.slice(0, 10)) : [];
  }

  function getUpcomingHours(count = 24) {
    const current = getCurrent();

    if (!current) {
      return [];
    }

    const currentHour = `${current.time.slice(0, 13)}:00`;
    return getForecast().hourly.filter((hour) => hour.time >= currentHour).slice(0, count);
  }

  function getDailyForecast(days) {
    const daily = getForecast()?.daily ?? [];
    return typeof days === "number" ? daily.slice(0, days) : daily;
  }

  function getToday() {
    return getDailyForecast(1)[0] ?? null;
  }

  return {
    refresh,
    bindRefreshButton,
    startAutoRefresh,
    stopAutoRefresh,
    subscribe: weatherStore.subscribe,
    getState: weatherStore.getState,
    getCurrent,
    getUnits,
    getToday,
    getTodayHourly,
    getHourlyForDate,
    getUpcomingHours,
    getDailyForecast,
    clock: clockService
  };
})();

const hourlyChart = (function () {
  const HOUR_WIDTH = 56;
  const HEIGHT = 64;
  const PADDING = 8;
  const BAR_WIDTH = 16;
  const BAR_RADIUS = 4;

  function scale(value, [min, max]) {
    const ratio = max === min ? 0.5 : (value - min) / (max - min);
    return HEIGHT - PADDING - ratio * (HEIGHT - PADDING * 2);
  }

  function columnCenter(index) {
    return index * HOUR_WIDTH + HOUR_WIDTH / 2;
  }

  function smoothPath(points) {
    return points.reduce((path, point, index) => {
      if (index === 0) {
        return `M ${point.x} ${point.y}`;
      }

      const previous = points[index - 1];
      const handle = (point.x - previous.x) / 2;
      return `${path} C ${previous.x + handle} ${previous.y}, ${point.x - handle} ${point.y}, ${point.x} ${point.y}`;
    }, "");
  }

  function barPath(centerX, top) {
    const left = centerX - BAR_WIDTH / 2;
    const right = centerX + BAR_WIDTH / 2;
    const base = HEIGHT;
    const radius = Math.min(BAR_RADIUS, base - top);

    return `M ${left} ${base} V ${top + radius} Q ${left} ${top} ${left + radius} ${top} H ${right - radius} Q ${right} ${top} ${right} ${top + radius} V ${base} Z`;
  }

  function renderLine(values, domain) {
    const points = values.map((value, index) => ({ x: columnCenter(index), y: scale(value, domain) }));
    const line = smoothPath(points);
    const first = points[0];
    const last = points[points.length - 1];

    return {
      points,
      markup: `
        <path class="chart-area" d="${line} L ${last.x} ${HEIGHT} L ${first.x} ${HEIGHT} Z"></path>
        <path class="chart-line" d="${line}" pathLength="100"></path>
      `
    };
  }

  function renderBars(values, domain) {
    const points = values.map((value, index) => ({ x: columnCenter(index), y: scale(value, domain) }));

    return {
      points,
      markup: `
        <line class="chart-baseline" x1="0" y1="${HEIGHT - 0.5}" x2="${values.length * HOUR_WIDTH}" y2="${HEIGHT - 0.5}"></line>
        ${points.map((point, index) => (values[index] > 0 ? `<path class="chart-bar" data-index="${index}" d="${barPath(point.x, Math.min(point.y, HEIGHT - 2))}"></path>` : "")).join("")}
      `
    };
  }

  function render(svg, values, { type, domain }) {
    const width = values.length * HOUR_WIDTH;
    const { points, markup } = type === "bar" ? renderBars(values, domain) : renderLine(values, domain);

    svg.setAttribute("viewBox", `0 0 ${width} ${HEIGHT}`);
    svg.setAttribute("width", width);
    svg.setAttribute("height", HEIGHT);
    svg.dataset.type = type;
    svg.innerHTML = `
      ${markup}
      <line class="chart-crosshair" x1="0" y1="0" x2="0" y2="${HEIGHT}"></line>
      <circle class="chart-marker" r="4" cx="0" cy="0"></circle>
    `;

    return points;
  }

  function highlight(svg, points, index) {
    const crosshair = svg.querySelector(".chart-crosshair");
    const marker = svg.querySelector(".chart-marker");

    svg.querySelectorAll(".chart-bar.is-active").forEach((bar) => bar.classList.remove("is-active"));

    if (index === null || !points[index]) {
      svg.classList.remove("is-highlighted");
      return;
    }

    const point = points[index];
    svg.classList.add("is-highlighted");
    crosshair.setAttribute("x1", point.x);
    crosshair.setAttribute("x2", point.x);
    marker.setAttribute("cx", point.x);
    marker.setAttribute("cy", point.y);
    svg.querySelector(`.chart-bar[data-index="${index}"]`)?.classList.add("is-active");
  }

  return {
    render,
    highlight
  };
})();

const weatherView = (function () {
  const ANIMATION_WINDOW_MS = 1400;
  const SNACKBAR_DURATION_MS = 4000;
  const SWIPE_THRESHOLD = 72;
  const SWIPE_RESISTANCE = 0.45;
  const SWIPE_DEAD_ZONE = 8;
  const WHEEL_GESTURE_GAP_MS = 250;
  const WHEEL_RELEASE_DELAY_MS = 160;
  const MOMENTUM_FRICTION = 0.94;

  const COMPASS_NAMES = Object.freeze({
    N: "north",
    NE: "northeast",
    E: "east",
    SE: "southeast",
    S: "south",
    SW: "southwest",
    W: "west",
    NW: "northwest"
  });

  const UV_LEVELS = [
    { max: 3, label: "Low" },
    { max: 6, label: "Moderate" },
    { max: 8, label: "High" },
    { max: 11, label: "Very high" },
    { max: Infinity, label: "Extreme" }
  ];

  const HOURLY_METRICS = Object.freeze({
    temperature: {
      caption: (units) => `Temperature in ${units.temperature}`,
      value: (hour) => hour.temperature,
      format: (value) => `${Math.round(value)}°`,
      type: "line",
      domain: (values) => [Math.min(...values) - 1, Math.max(...values) + 1]
    },
    precipitation: {
      caption: () => "Chance of precipitation",
      value: (hour) => hour.precipitationProbability ?? 0,
      format: (value) => `${Math.round(value)}%`,
      type: "bar",
      domain: () => [0, 100]
    },
    wind: {
      caption: (units) => `Wind speed in ${units.windSpeed}`,
      value: (hour) => hour.windSpeed,
      format: (value) => `${Math.round(value)}`,
      type: "line",
      domain: (values) => [0, Math.max(...values, 10)]
    }
  });

  const elements = {};

  const viewState = {
    metric: "temperature",
    selectedDate: null,
    hourlyPoints: [],
    hours: [],
    renderedMinute: null,
    snackbarTimer: null,
    isSwiping: false,
    animationTimer: null,
    hasRendered: false
  };

  function cacheElements() {
    const ids = {
      app: "app",
      cityName: "city_name",
      clockTime: "clock_time",
      clockDate: "clock_date",
      heroIcon: "current_icon",
      temperature: "temperature",
      description: "current_description",
      temperatureRange: "temperature_range",
      hourlyPanel: "hourly_panel",
      hourlySubtitle: "hourly_subtitle",
      hourlyScroller: "hourly_scroller",
      hourlyTrack: "hourly_track",
      swipeIndicator: "swipe_indicator",
      swipeIndicatorIcon: "swipe_indicator_icon",
      swipeIndicatorLabel: "swipe_indicator_label",
      hourlyChart: "hourly_chart",
      hourlyList: "hourly_list",
      hourlyTooltip: "hourly_tooltip",
      daily: "daily_forecast",
      tiles: "tiles",
      lastUpdated: "last_updated",
      snackbar: "snackbar",
      snackbarText: "snackbar_text",
      snackbarAction: "snackbar_action"
    };

    Object.entries(ids).forEach(([key, id]) => {
      elements[key] = document.getElementById(id);
    });

    elements.metricButtons = document.querySelectorAll("[data-metric]");
  }

  function isMissing(value) {
    return value === null || value === undefined || Number.isNaN(value);
  }

  function icon(name, className = "") {
    return `<span class="icon ${className}" aria-hidden="true">${name}</span>`;
  }

  function formatTemperature(value) {
    return isMissing(value) ? "--" : `${Math.round(value)}°`;
  }

  function formatValue(value, unit, digits = 0) {
    return isMissing(value) ? "--" : `${value.toFixed(digits)} ${unit}`;
  }

  function formatPercentage(value) {
    return isMissing(value) ? "--" : `${Math.round(value)}%`;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function animate() {
    elements.app.dataset.animate = "";
    clearTimeout(viewState.animationTimer);
    viewState.animationTimer = setTimeout(() => {
      delete elements.app.dataset.animate;
    }, ANIMATION_WINDOW_MS);
  }

  function animateNumber(element, target, format) {
    const start = Number(element.dataset.value ?? 0);
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700;
    const startTime = performance.now();

    element.dataset.value = target;

    function step(now) {
      const progress = duration === 0 ? 1 : clamp((now - startTime) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = format(start + (target - start) * eased);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }

  function ring(percentage) {
    const value = clamp(percentage ?? 0, 0, 100);

    return `
      <svg class="ring" viewBox="0 0 64 64" aria-hidden="true">
        <circle class="ring-track" cx="32" cy="32" r="26" pathLength="100"></circle>
        <circle class="ring-indicator" cx="32" cy="32" r="26" pathLength="100" style="--value: ${value}"></circle>
      </svg>
    `;
  }

  function meter(percentage) {
    return `<span class="meter" aria-hidden="true"><span class="meter-indicator" style="--value: ${clamp(percentage, 0, 100)}%"></span></span>`;
  }

  function gauge(percentage) {
    const value = clamp(percentage, 0, 100);
    const angle = Math.PI * (1 - value / 100);
    const x = 56 + 44 * Math.cos(angle);
    const y = 52 - 44 * Math.sin(angle);

    return `
      <svg class="gauge" viewBox="0 0 112 60" aria-hidden="true">
        <path class="gauge-track" d="M 12 52 A 44 44 0 0 1 100 52" pathLength="100"></path>
        <path class="gauge-indicator" d="M 12 52 A 44 44 0 0 1 100 52" pathLength="100" style="--value: ${value}"></path>
        <circle class="gauge-marker" cx="${x}" cy="${y}" r="5"></circle>
      </svg>
    `;
  }

  function compass(degrees) {
    const ticks = Array.from({ length: 12 }, (_, index) => {
      const angle = (index * 30 * Math.PI) / 180;
      const inner = index % 3 === 0 ? 40 : 44;
      return `<line x1="${60 + inner * Math.sin(angle)}" y1="${60 - inner * Math.cos(angle)}" x2="${60 + 48 * Math.sin(angle)}" y2="${60 - 48 * Math.cos(angle)}"></line>`;
    }).join("");

    return `
      <svg class="compass" viewBox="0 0 120 120" aria-hidden="true">
        <circle class="compass-face" cx="60" cy="60" r="54"></circle>
        <g class="compass-ticks">${ticks}</g>
        <text x="60" y="27">N</text>
        <text x="96" y="64">E</text>
        <text x="60" y="100">S</text>
        <text x="24" y="64">W</text>
        <g class="compass-needle" style="--angle: ${((degrees ?? 0) + 180) % 360}deg">
          <path d="M 60 30 L 69 66 L 60 60 L 51 66 Z"></path>
        </g>
        <circle class="compass-hub" cx="60" cy="60" r="4"></circle>
      </svg>
    `;
  }

  function sunArc(progress, isUp) {
    const angle = Math.PI * (1 - progress);
    const x = 120 + 100 * Math.cos(angle);
    const y = 108 - 100 * Math.sin(angle);

    return `
      <svg class="sun-arc" viewBox="0 0 240 120" aria-hidden="true">
        <line class="sun-horizon" x1="0" y1="108.5" x2="240" y2="108.5"></line>
        <path class="sun-track" d="M 20 108 A 100 100 0 0 1 220 108" pathLength="100"></path>
        <path class="sun-progress" d="M 20 108 A 100 100 0 0 1 220 108" pathLength="100" style="--value: ${progress * 100}"></path>
        <circle class="sun-dot${isUp ? "" : " is-down"}" cx="${x}" cy="${y}" r="9"></circle>
      </svg>
    `;
  }

  function tile({ key, icon: iconName, label, value, supporting, visual = "", wide = false }) {
    return `
      <article class="tile${wide ? " tile-wide" : ""}" data-tile="${key}">
        <h3 class="tile-label">${icon(iconName)}${label}</h3>
        <div class="tile-body">
          <div class="tile-text">
            <p class="tile-value">${value}</p>
            <p class="tile-supporting">${supporting}</p>
          </div>
          ${visual}
        </div>
      </article>
    `;
  }

  function getUvLevel(uvIndex) {
    return isMissing(uvIndex) ? "" : UV_LEVELS.find((level) => uvIndex < level.max).label;
  }

  function buildWindTile({ current, units }) {
    const direction = COMPASS_NAMES[current.windCompass];

    return tile({
      key: "wind",
      icon: "air",
      label: "Wind",
      wide: true,
      value: formatValue(current.windSpeed, units.windSpeed),
      supporting: `${direction ? `From the ${direction}` : "Direction unknown"} · Gusts up to ${formatValue(current.windGusts, units.windSpeed)}`,
      visual: compass(current.windDirection)
    });
  }

  function buildSunTile({ daily }) {
    const clock = weatherApp.clock;
    const today = daily[0];
    const tomorrow = daily[1];

    if (!today?.sunrise || !today?.sunset) {
      return tile({ key: "sun", icon: "wb_twilight", label: "Sunrise & sunset", wide: true, value: "--", supporting: "" });
    }

    const now = clock.nowIso();
    const dayLength = clock.minutesBetween(today.sunrise, today.sunset);
    const elapsed = clock.minutesBetween(today.sunrise, now);
    const progress = clamp(elapsed / dayLength, 0, 1);
    const isUp = elapsed >= 0 && elapsed <= dayLength;

    let value;

    if (elapsed < 0) {
      value = `Sunrise in ${clock.formatDuration(-elapsed * 60)}`;
    } else if (isUp) {
      value = `Sunset in ${clock.formatDuration((dayLength - elapsed) * 60)}`;
    } else if (tomorrow?.sunrise) {
      value = `Sunrise in ${clock.formatDuration(clock.minutesBetween(now, tomorrow.sunrise) * 60)}`;
    } else {
      value = "Sun has set";
    }

    return tile({
      key: "sun",
      icon: "wb_twilight",
      label: "Sunrise & sunset",
      wide: true,
      value,
      supporting: `
        <span class="sun-times">
          <span>${icon("arrow_upward")}${clock.formatForecastHour(today.sunrise)}</span>
          <span>${icon("arrow_downward")}${clock.formatForecastHour(today.sunset)}</span>
        </span>
        ${clock.formatDuration(dayLength * 60)} of daylight
      `,
      visual: sunArc(progress, isUp)
    });
  }

  function buildUvTile({ current, daily }) {
    const todayHours = weatherApp.getHourlyForDate(daily[0]?.date);
    const exposedHours = todayHours.filter((hour) => hour.uvIndex >= 3);

    const supporting = exposedHours.length > 0
      ? `Protection advised ${exposedHours[0].hour}–${String(Number(exposedHours[exposedHours.length - 1].hour.slice(0, 2)) + 1).padStart(2, "0")}:00`
      : "No protection needed today";

    return tile({
      key: "uv",
      icon: "light_mode",
      label: "UV index",
      value: isMissing(current.uvIndex) ? "--" : `${Math.round(current.uvIndex)} <small>${getUvLevel(current.uvIndex)}</small>`,
      supporting,
      visual: meter(((current.uvIndex ?? 0) / 11) * 100)
    });
  }

  function buildHumidityTile({ current }) {
    const humidity = current.humidity;
    let comfort = "Comfortable";

    if (humidity < 30) {
      comfort = "Dry air";
    } else if (humidity >= 80) {
      comfort = "Very humid";
    } else if (humidity >= 60) {
      comfort = "Humid";
    }

    return tile({
      key: "humidity",
      icon: "humidity_percentage",
      label: "Humidity",
      value: formatPercentage(humidity),
      supporting: comfort,
      visual: ring(humidity)
    });
  }

  function buildFeelsLikeTile({ current }) {
    const difference = current.apparentTemperature - current.temperature;
    let supporting = "Similar to the actual temperature";

    if (difference <= -2) {
      supporting = "Wind makes it feel colder";
    } else if (difference >= 2) {
      supporting = "Humidity makes it feel warmer";
    }

    return tile({
      key: "feels-like",
      icon: "thermostat",
      label: "Feels like",
      value: formatTemperature(current.apparentTemperature),
      supporting
    });
  }

  function buildDewPointTile({ current }) {
    const dewPoint = current.dewPoint;
    let supporting = "Comfortable";

    if (dewPoint < 10) {
      supporting = "Crisp, dry air";
    } else if (dewPoint >= 20) {
      supporting = "Oppressive";
    } else if (dewPoint >= 16) {
      supporting = "Muggy";
    }

    return tile({
      key: "dew-point",
      icon: "dew_point",
      label: "Dew point",
      value: formatTemperature(dewPoint),
      supporting
    });
  }

  function buildPrecipitationTile({ current, units, daily }) {
    const today = daily[0] ?? {};

    return tile({
      key: "precipitation",
      icon: "water_drop",
      label: "Precipitation",
      value: `${formatValue(today.precipitationSum, units.precipitation, 1)} <small>today</small>`,
      supporting: current.precipitation > 0
        ? `${formatValue(current.precipitation, units.precipitation, 1)} in the last hour`
        : `${formatPercentage(today.precipitationProbabilityMax)} chance of precipitation`
    });
  }

  function buildCloudTile({ current }) {
    const cover = current.cloudCover;
    let supporting = "Overcast";

    if (cover < 15) {
      supporting = "Clear skies";
    } else if (cover < 50) {
      supporting = "Partly cloudy";
    } else if (cover < 85) {
      supporting = "Mostly cloudy";
    }

    return tile({
      key: "cloud-cover",
      icon: "cloud",
      label: "Cloud cover",
      value: formatPercentage(cover),
      supporting,
      visual: ring(cover)
    });
  }

  function buildPressureTile({ current, units }) {
    const pressure = current.pressure;
    let supporting = "Normal";

    if (pressure >= 1020) {
      supporting = "High · Settled weather";
    } else if (pressure < 1000) {
      supporting = "Low · Unsettled weather";
    }

    return tile({
      key: "pressure",
      icon: "compress",
      label: "Pressure",
      value: formatValue(pressure, units.pressure),
      supporting,
      visual: gauge(((pressure - 970) / 80) * 100)
    });
  }

  function buildVisibilityTile({ current }) {
    const meters = current.visibility;
    let value = "--";
    let supporting = "";

    if (!isMissing(meters)) {
      value = meters >= 1000 ? `${Math.round(meters / 1000)} km` : `${Math.round(meters)} m`;

      if (meters >= 10000) {
        supporting = "Perfectly clear view";
      } else if (meters >= 5000) {
        supporting = "Good visibility";
      } else if (meters >= 1000) {
        supporting = "Hazy";
      } else {
        supporting = "Poor visibility";
      }
    }

    return tile({
      key: "visibility",
      icon: "visibility",
      label: "Visibility",
      value,
      supporting
    });
  }

  const TILE_BUILDERS = [
    buildWindTile,
    buildSunTile,
    buildUvTile,
    buildHumidityTile,
    buildFeelsLikeTile,
    buildDewPointTile,
    buildPrecipitationTile,
    buildCloudTile,
    buildPressureTile,
    buildVisibilityTile
  ];

  function renderTiles(forecast) {
    elements.tiles.innerHTML = TILE_BUILDERS.map((build) => build(forecast)).join("");
  }

  function renderSunTile(forecast) {
    const sunTile = elements.tiles.querySelector("[data-tile='sun']");

    if (sunTile) {
      sunTile.outerHTML = buildSunTile(forecast);
    }
  }

  function renderClock(snapshot) {
    elements.clockTime.textContent = snapshot.time;
    elements.clockTime.dateTime = snapshot.date.toISOString();
    elements.clockDate.textContent = `${snapshot.weekday} ${snapshot.shortDate}`;

    const forecast = weatherApp.getState().forecast;

    if (forecast && viewState.renderedMinute !== snapshot.time) {
      viewState.renderedMinute = snapshot.time;
      renderSunTile(forecast);
    }
  }

  function renderHero(forecast) {
    const { current, daily } = forecast;
    const today = daily[0];

    elements.heroIcon.textContent = current.weather.icon;
    elements.description.textContent = current.weather.description;
    elements.temperatureRange.textContent = `H ${formatTemperature(today?.temperatureMax)} · L ${formatTemperature(today?.temperatureMin)}`;
    animateNumber(elements.temperature, current.temperature, (value) => `${Math.round(value)}°`);
  }

  function getSelectedHours() {
    if (viewState.selectedDate === null) {
      return weatherApp.getUpcomingHours(24);
    }
    return weatherApp.getHourlyForDate(viewState.selectedDate);
  }

  function renderHourly(forecast) {
    const metric = HOURLY_METRICS[viewState.metric];
    const hours = getSelectedHours();
    const values = hours.map(metric.value);
    const isUpcoming = viewState.selectedDate === null;
    const dayLabel = isUpcoming ? "Next 24 hours" : weatherApp.clock.formatForecastDay(viewState.selectedDate);

    viewState.hours = hours;
    elements.hourlySubtitle.textContent = `${dayLabel} · ${metric.caption(forecast.units)}`;

    elements.hourlyList.innerHTML = hours.map((hour, index) => {
      const symbol = viewState.metric === "wind"
        ? `<span class="icon hour-icon wind-arrow" aria-hidden="true" style="--angle: ${((hour.windDirection ?? 0) + 180) % 360}deg">navigation</span>`
        : icon(hour.weather.icon, "hour-icon");
      const time = isUpcoming && index === 0 ? "Now" : hour.hour;

      return `
        <li class="hour${isUpcoming && index === 0 ? " is-now" : ""}" tabindex="0" data-index="${index}" aria-label="${time}, ${hour.weather.description}, ${metric.format(values[index])}">
          <span class="hour-time">${time}</span>
          ${symbol}
          <span class="hour-chart-slot"></span>
          <span class="hour-value">${metric.format(values[index])}</span>
        </li>
      `;
    }).join("");

    viewState.hourlyPoints = hourlyChart.render(elements.hourlyChart, values, {
      type: metric.type,
      domain: metric.domain(values)
    });

    elements.metricButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.metric === viewState.metric));
    });

    setActiveHour(null);
  }

  function setActiveHour(index) {
    elements.hourlyList.querySelectorAll(".hour.is-active").forEach((hour) => hour.classList.remove("is-active"));
    hourlyChart.highlight(elements.hourlyChart, viewState.hourlyPoints, index);

    const hour = index === null ? null : viewState.hours[index];

    if (!hour) {
      elements.hourlyTooltip.hidden = true;
      return;
    }

    const item = elements.hourlyList.children[index];
    item.classList.add("is-active");

    const units = weatherApp.getUnits();
    elements.hourlyTooltip.replaceChildren();

    const title = document.createElement("strong");
    title.textContent = `${hour.hour} · ${hour.weather.description}`;

    const detail = document.createElement("span");
    detail.textContent = `${formatTemperature(hour.temperature)} · Rain ${formatPercentage(hour.precipitationProbability)} · Wind ${formatValue(hour.windSpeed, units.windSpeed)} ${hour.windCompass ?? ""}`;

    elements.hourlyTooltip.append(title, detail);
    elements.hourlyTooltip.hidden = false;

    const panelRect = elements.hourlyPanel.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const tooltipWidth = elements.hourlyTooltip.offsetWidth;
    const center = itemRect.left + itemRect.width / 2 - panelRect.left;
    const left = clamp(center, tooltipWidth / 2 + 12, panelRect.width - tooltipWidth / 2 - 12);

    elements.hourlyTooltip.style.left = `${left}px`;
    elements.hourlyTooltip.style.top = `${itemRect.top - panelRect.top - 8}px`;
  }

  function renderDaily(forecast) {
    const days = forecast.daily;

    if (days.length === 0) {
      elements.daily.innerHTML = "";
      return;
    }

    const weekMin = Math.min(...days.map((day) => day.temperatureMin));
    const weekMax = Math.max(...days.map((day) => day.temperatureMax));
    const weekRange = Math.max(weekMax - weekMin, 1);
    const position = (value) => ((value - weekMin) / weekRange) * 100;
    const currentTemperature = forecast.current.temperature;

    elements.daily.innerHTML = days.map((day, index) => {
      const isSelected = index === 0 ? viewState.selectedDate === null : viewState.selectedDate === day.date;
      const name = index === 0 ? "Today" : weatherApp.clock.formatForecastDay(day.date, { weekday: "short" });
      const showPrecipitation = day.precipitationProbabilityMax >= 10;
      const nowMarker = index === 0
        ? `<span class="day-range-now" style="--position: ${clamp(position(currentTemperature), 0, 100)}%"></span>`
        : "";

      return `
        <li>
          <button type="button" class="day" data-date="${index === 0 ? "" : day.date}" aria-pressed="${isSelected}"
            aria-label="${index === 0 ? "Today" : weatherApp.clock.formatForecastDay(day.date)}: ${day.weather.description}, high ${formatTemperature(day.temperatureMax)}, low ${formatTemperature(day.temperatureMin)}">
            <span class="day-name">${name}</span>
            ${icon(day.weather.icon, "day-icon")}
            <span class="day-precipitation">${showPrecipitation ? `${icon("water_drop")}${formatPercentage(day.precipitationProbabilityMax)}` : ""}</span>
            <span class="day-min">${formatTemperature(day.temperatureMin)}</span>
            <span class="day-range" aria-hidden="true">
              <span class="day-range-fill" style="--start: ${position(day.temperatureMin)}%; --end: ${position(day.temperatureMax)}%"></span>
              ${nowMarker}
            </span>
            <span class="day-max">${formatTemperature(day.temperatureMax)}</span>
          </button>
        </li>
      `;
    }).join("");
  }

  function renderLastUpdated(state) {
    elements.lastUpdated.textContent = state.lastUpdated
      ? `Updated at ${weatherApp.clock.formatTime(state.lastUpdated)} · Data by Open-Meteo`
      : "";
  }

  function renderError(state) {
    if (state.forecast !== null) {
      return;
    }

    elements.cityName.textContent = "Location unavailable";
    elements.description.textContent = "Allow location access to see the weather";
    elements.temperature.textContent = "--°";
  }

  function render(state) {
    const isRefreshing = state.status === "loading" && state.forecast !== null;

    if (state.status === "error") {
      elements.app.dataset.state = state.forecast ? "ready" : "error";
      renderError(state);
      showSnackbar("Couldn't update the weather", { label: "Retry", onClick: () => weatherApp.refresh() });
      return;
    }

    elements.app.dataset.state = state.status === "ready" || isRefreshing ? "ready" : "loading";
    elements.app.toggleAttribute("data-refreshing", isRefreshing);

    if (state.status !== "ready") {
      return;
    }

    if (!viewState.hasRendered) {
      viewState.hasRendered = true;
      animate();
    }

    elements.cityName.textContent = state.location.cityName;
    renderHero(state.forecast);
    renderHourly(state.forecast);
    renderDaily(state.forecast);
    renderTiles(state.forecast);
    renderLastUpdated(state);
    backgroundService.apply(state.forecast.current.weather);
  }

  function showSnackbar(message, action = null) {
    elements.snackbarText.textContent = message;
    elements.snackbarAction.hidden = action === null;
    elements.snackbarAction.onclick = action
      ? () => {
        hideSnackbar();
        action.onClick();
      }
      : null;

    if (action) {
      elements.snackbarAction.textContent = action.label;
    }

    elements.snackbar.classList.add("is-visible");
    clearTimeout(viewState.snackbarTimer);
    viewState.snackbarTimer = setTimeout(hideSnackbar, SNACKBAR_DURATION_MS);
  }

  function hideSnackbar() {
    elements.snackbar.classList.remove("is-visible");
  }

  function handleManualRefresh(state) {
    if (state.status === "ready") {
      animate();
      renderTiles(state.forecast);
      showSnackbar("Weather updated");
    }
  }

  function getDaySequence() {
    return weatherApp.getDailyForecast().map((day, index) => (index === 0 ? null : day.date));
  }

  function getAdjacentDay(step) {
    const sequence = getDaySequence();
    const index = sequence.indexOf(viewState.selectedDate) + step;

    if (index < 0 || index >= sequence.length) {
      return null;
    }

    const date = sequence[index];
    const label = date === null ? "Today" : weatherApp.clock.formatForecastDay(date);
    return { date, label };
  }

  function playTrackEntrance(direction) {
    const track = elements.hourlyTrack;
    delete track.dataset.enter;
    void track.offsetWidth;
    track.dataset.enter = direction > 0 ? "next" : "previous";
  }

  function selectDay(date, direction) {
    const forecast = weatherApp.getState().forecast;

    if (!forecast) {
      return;
    }

    viewState.selectedDate = date;
    renderDaily(forecast);
    renderHourly(forecast);

    const scroller = elements.hourlyScroller;
    scroller.scrollLeft = direction < 0 ? scroller.scrollWidth : 0;
    playTrackEntrance(direction);
  }

  function setPull(distance, step) {
    const adjacent = step === 0 ? null : getAdjacentDay(step);
    const offset = adjacent ? distance : distance * 0.35;
    const progress = adjacent ? clamp(Math.abs(distance) / SWIPE_THRESHOLD, 0, 1) : 0;
    const isArmed = progress >= 1;
    const indicator = elements.swipeIndicator;

    elements.hourlyTrack.style.transform = offset === 0 ? "" : `translateX(${offset}px)`;
    indicator.style.setProperty("--progress", progress);
    indicator.dataset.side = step > 0 ? "next" : "previous";
    indicator.hidden = progress === 0;

    if (adjacent) {
      elements.swipeIndicatorIcon.textContent = step > 0 ? "arrow_forward" : "arrow_back";
      elements.swipeIndicatorLabel.textContent = adjacent.label;
    }

    if (isArmed && !indicator.classList.contains("is-armed")) {
      navigator.vibrate?.(8);
    }

    indicator.classList.toggle("is-armed", isArmed);
    return isArmed ? adjacent : null;
  }

  function releasePull(target, step) {
    const track = elements.hourlyTrack;

    track.classList.add("is-settling");
    setPull(0, 0);
    track.addEventListener("transitionend", () => track.classList.remove("is-settling"), { once: true });

    if (target) {
      selectDay(target.date, step);
    }
  }

  function applyDrag(scrollTarget) {
    const scroller = elements.hourlyScroller;
    const maxScroll = scroller.scrollWidth - scroller.clientWidth;
    const overflow = scrollTarget < 0 ? scrollTarget : Math.max(scrollTarget - maxScroll, 0);

    scroller.scrollLeft = clamp(scrollTarget, 0, maxScroll);
    return { step: Math.sign(overflow), target: setPull(-overflow * SWIPE_RESISTANCE, Math.sign(overflow)) };
  }

  function startMomentum(velocity) {
    const scroller = elements.hourlyScroller;
    let speed = velocity;
    let previousTime = performance.now();

    function frame(now) {
      const elapsed = now - previousTime;
      previousTime = now;
      scroller.scrollLeft -= speed * elapsed;
      speed *= Math.pow(MOMENTUM_FRICTION, elapsed / 16);

      if (Math.abs(speed) > 0.02 && !viewState.isSwiping) {
        requestAnimationFrame(frame);
      }
    }

    requestAnimationFrame(frame);
  }

  function bindDaySwipe() {
    const scroller = elements.hourlyScroller;
    let gesture = null;
    let wheel = { distance: 0, lastEvent: 0, active: false, timer: null, result: null };

    scroller.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      gesture = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startScroll: scroller.scrollLeft,
        lastX: event.clientX,
        lastTime: event.timeStamp,
        velocity: 0,
        dragging: false,
        result: { step: 0, target: null }
      };
    });

    scroller.addEventListener("pointermove", (event) => {
      if (!gesture || event.pointerId !== gesture.id) {
        return;
      }

      const deltaX = event.clientX - gesture.startX;
      const deltaY = event.clientY - gesture.startY;

      if (!gesture.dragging) {
        if (Math.abs(deltaX) < SWIPE_DEAD_ZONE && Math.abs(deltaY) < SWIPE_DEAD_ZONE) {
          return;
        }

        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          gesture = null;
          return;
        }

        gesture.dragging = true;
        viewState.isSwiping = true;
        scroller.setPointerCapture(event.pointerId);
        elements.hourlyPanel.classList.add("is-dragging");
        setActiveHour(null);
      }

      const elapsed = Math.max(event.timeStamp - gesture.lastTime, 1);
      gesture.velocity = (event.clientX - gesture.lastX) / elapsed;
      gesture.lastX = event.clientX;
      gesture.lastTime = event.timeStamp;
      gesture.result = applyDrag(gesture.startScroll - deltaX);
    });

    function endGesture(event) {
      if (!gesture || event.pointerId !== gesture.id) {
        return;
      }

      const { dragging, result, velocity } = gesture;
      gesture = null;

      if (!dragging) {
        return;
      }

      viewState.isSwiping = false;
      elements.hourlyPanel.classList.remove("is-dragging");
      releasePull(result.target, result.step);

      if (!result.target && result.step === 0 && event.type === "pointerup") {
        startMomentum(velocity);
      }
    }

    scroller.addEventListener("pointerup", endGesture);
    scroller.addEventListener("pointercancel", endGesture);

    scroller.addEventListener("wheel", (event) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
        return;
      }

      const maxScroll = scroller.scrollWidth - scroller.clientWidth;
      const pushingPastEnd = event.deltaX > 0 && scroller.scrollLeft >= maxScroll - 1;
      const pushingPastStart = event.deltaX < 0 && scroller.scrollLeft <= 0;
      const isNewGesture = event.timeStamp - wheel.lastEvent > WHEEL_GESTURE_GAP_MS;
      wheel.lastEvent = event.timeStamp;

      if (!wheel.active && (!(pushingPastEnd || pushingPastStart) || !isNewGesture)) {
        return;
      }

      event.preventDefault();
      wheel.active = true;
      wheel.distance += event.deltaX;

      const step = Math.sign(wheel.distance);
      wheel.result = { step, target: setPull(-wheel.distance * SWIPE_RESISTANCE, step) };

      clearTimeout(wheel.timer);
      wheel.timer = setTimeout(() => {
        releasePull(wheel.result.target, wheel.result.step);
        wheel = { ...wheel, distance: 0, active: false, result: null };
      }, WHEEL_RELEASE_DELAY_MS);
    }, { passive: false });
  }

  function bindEvents() {
    elements.metricButtons.forEach((button) => {
      button.addEventListener("click", () => {
        viewState.metric = button.dataset.metric;
        const forecast = weatherApp.getState().forecast;

        if (forecast) {
          renderHourly(forecast);
        }
      });
    });

    elements.daily.addEventListener("click", (event) => {
      const button = event.target.closest(".day");
      const forecast = weatherApp.getState().forecast;

      if (!button || !forecast) {
        return;
      }

      const date = button.dataset.date || null;
      const sequence = getDaySequence();
      const direction = Math.sign(sequence.indexOf(date) - sequence.indexOf(viewState.selectedDate));

      if (direction !== 0) {
        selectDay(date, direction);
      }
    });

    elements.hourlyList.addEventListener("pointerover", (event) => {
      const hour = event.target.closest(".hour");

      if (hour && !viewState.isSwiping) {
        setActiveHour(Number(hour.dataset.index));
      }
    });

    elements.hourlyList.addEventListener("focusin", (event) => {
      const hour = event.target.closest(".hour");

      if (hour) {
        setActiveHour(Number(hour.dataset.index));
      }
    });

    elements.hourlyList.addEventListener("pointerleave", () => setActiveHour(null));
    elements.hourlyList.addEventListener("focusout", () => setActiveHour(null));
    elements.hourlyScroller.addEventListener("scroll", () => setActiveHour(null), { passive: true });

    bindDaySwipe();

    document.querySelectorAll("[data-action='refresh']").forEach((button) => {
      weatherApp.bindRefreshButton(button, handleManualRefresh);
    });
  }

  function init() {
    cacheElements();
    bindEvents();
    weatherApp.clock.subscribe(renderClock);
    weatherApp.subscribe(render);
  }

  return {
    init
  };
})();

document.addEventListener("DOMContentLoaded", async function () {
  backgroundService.preload();
  weatherView.init();

  await weatherApp.refresh();
  weatherApp.startAutoRefresh();
});
