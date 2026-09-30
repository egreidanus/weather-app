const locationService = (function () {
  let position = null;

  async function init() {
    if ("geolocation" in navigator) {
      try {
        position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
      } catch (error) {
        console.error("Error while retrieving location:", error);
      }
    } else {
      console.error("navigator.geolocation is not available in your browser.");
    }
  }

  async function getCoords() {
    if (position !== null) {
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
    } else {
      return {
        latitude: null,
        longitude: null
      };
    }
  }

  async function getCityName() {
    if (position !== null) {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=nl`;

      try {
        const response = await fetch(url);
        const data = await response.json();
        return data.city || data.locality || "Onbekende locatie";
      } catch (error) {
        console.error("Error while retrieving cityname: ", error);
      }
    }
    return "Onbekende locatie";
  }

  return {
    init,
    getCoords,
    getCityName
  };
})();

const weatherService = (function () {
  async function callWeatherApi(latitude, longitude, endpoint, params = {}) {
    const queryParams = new URLSearchParams({
      latitude: latitude,
      longitude: longitude,
      ...params
    });

    const apiUrl = `https://api.open-meteo.com/v1/${endpoint}?${queryParams.toString()}`;

    try {
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });
      return await response.json();
    } catch (error) {
      console.error("Error while calling the weather API:", error);
    }
  }

  async function getWeatherInformation(latitude, longitude) {
    return await callWeatherApi(latitude, longitude, "forecast", {
      "current": "temperature_2m"
    });
  }

  return {
    getWeatherInformation
  };
})();

document.addEventListener("DOMContentLoaded", async function () {
  let data = {
    weather: {
      location: { latitude: null, longitude: null },
      temperature_2m: "-",
      temperature_2m_unit: "°C"
    }
  };

  async function loop(currentData) {
    let coords = await locationService.getCoords();

    if (coords.latitude === null) {
      await locationService.init();
      coords = await locationService.getCoords();
    }

    if (coords.latitude !== null) {
      currentData.weather.location.latitude = coords.latitude;
      currentData.weather.location.longitude = coords.longitude;

      const weatherInfo = await weatherService.getWeatherInformation(coords.latitude, coords.longitude);

      if (weatherInfo && weatherInfo.current && weatherInfo.current_units) {
        currentData.weather.temperature_2m = weatherInfo.current.temperature_2m;
        currentData.weather.temperature_2m_unit = weatherInfo.current_units.temperature_2m;
      }

      await updateInformation(currentData);
    }

    return currentData;
  }

  async function updateInformation(currentData) {
    document.getElementById("temperature").innerText = currentData.weather.temperature_2m + currentData.weather.temperature_2m_unit;
    document.getElementById("city_name").innerText = await locationService.getCityName();
  }

  data = await loop(data);

  setInterval(async function () {
    data = await loop(data);
  }, 10000);
});
