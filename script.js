document.addEventListener("DOMContentLoaded", async function () {
  var data = {
    initialized: false,
    debugging: true,
    weather: {
      location: {
        city_name: null,
        longitude: null,
        latitude: null,
      },
      temperature_2m: null,
      temperature_2m_unit: null,
    }
  };

  // Initialize
  async function loop(data) {
    debug("loop start", data.debugging);

    // Check if the app is initialized
    if (!data.initialized) {
      debug("App not initialized", data.debugging);

      // Check if geolocation is available
      if (navigator.geolocation || "geolocation" in navigator) {

        debug("Navigator available", data.debugging);

        // Get the user position
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });

        debug("Got user location using navigator.geolocation", data.debugging);
        debug(position, data.debugging);

        // Store the user's position
        data.weather.location.latitude = position.coords.latitude;
        data.weather.location.longitude = position.coords.longitude;

        // Fetch the user's city name
        data.weather.location.city_name = await getCityName(data.weather.location.latitude, data.weather.location.longitude);

        // Mark the app as initialized
        data.initialized = true;

        debug("App marked as initialized", data.debugging);
      } else {
        // If the function cannot initialize then return the data
        return data;
      }
    }

    if (data.initialized) {
      debug("App is initialized", data.debugging);

      // Fetch weather information
      var weatherInfo = await getWeatherInformation(data.weather.location.latitude, data.weather.location.longitude);

      // Check if weather information is available
      if (weatherInfo && weatherInfo.current && weatherInfo.current_units) {
        debug("Weather information is available", data.debugging);

        // Store the weather information
        data.weather.temperature_2m = weatherInfo.current.temperature_2m;
        data.weather.temperature_2m_unit = weatherInfo.current_units.temperature_2m;
      }

      // Update the weather display
      updateInformation(data);
    }

    // Print the data to the console
    console.log(data);

    // Return the data
    return data;
  }


  // The debug function is used to log information to the console if the app is in debug mode
  function debug(message, isDebug = true) {
    if (isDebug) {
      console.log(message);
    }
  }

  async function updateInformation(data) {
    debug("Updating information on screen", data.debugging);
    document.getElementById("temperature").innerText = data.weather.temperature_2m + data.weather.temperature_2m_unit;
    document.getElementById("city_name").innerText = data.weather.location.city_name;
  }

  async function getWeatherInformation(latitude, longitude) {
    return await callWeatherApi(latitude, longitude, "forecast", {
      "current": "temperature_2m",
    });
  }

  async function getCityName(latitude, longitude) {
    // localityLanguage=nl ensures the city name is returned in Dutch if available
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=nl`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      // BigDataCloud provides a clean 'city' or 'locality' property
      return data.city || data.locality || "Unknown location";
    } catch (error) {
      console.error("Error fetching city name:", error);
      return "Unknown location";
    }
  }

  async function callWeatherApi(latitude, longitude, endpoint, params = {}) {
    var apiUrl = `https://api.open-meteo.com/v1/${endpoint}`;

    var queryParams = {
      latitude: latitude,
      longitude: longitude,
      ...params
    };

    apiUrl = `${apiUrl}?${new URLSearchParams(queryParams).toString()}`;

    console.log("API URL:", apiUrl);

    return fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    })
    .then(response => response.json())
    .then(data => {
      return data;
    })
    .catch(error => {
      console.error("Error:", error);
    });
  }

  // Run the update function and set an interval to update every 10 seconds
  data = await loop(data);

  setInterval(async function () {
    data = await loop(data);
  }, 10000);
});
