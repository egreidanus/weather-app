document.addEventListener("DOMContentLoaded", function () {
  async function update() {
    // The weather object to store weather information
    const weather = {
      location: {
        city_name: null,
        longitude: null,
        latitude: null,
      },
      temperature_2m: null,
      temperature_2m_unit: null,
    };

    // Check if geolocation is available
    if (navigator.geolocation || "geolocation" in navigator) {

      // Get the user's current position
      navigator.geolocation.getCurrentPosition(async function (position) {

        // Store the user's position
        weather.location.longitude = position.coords.longitude;
        weather.location.latitude = position.coords.latitude;

        // Fetch city name if it hasn't been fetched yet
        if (!weather.location.city_name) {
          weather.location.city_name = await getCityName(weather.location.latitude, weather.location.longitude);
        }

        console.log("Latitude: " + weather.location.latitude + ", Longitude: " + weather.location.longitude);

        // Fetch weather information
        var weatherInfo = await getWeatherInformation(weather.location.latitude, weather.location.longitude);

        // Check if weather information is available
        if (weatherInfo && weatherInfo.current && weatherInfo.current_units) {

          // Store the weather information
          weather.temperature_2m = weatherInfo.current.temperature_2m;
          weather.temperature_2m_unit = weatherInfo.current_units.temperature_2m;

          // Update the weather display
          await updateWeatherDisplayInformation(weather);
        }

        // Log the weather information
        console.log(weatherInfo);
        console.log(weather);
      });
    } else {
      // When there is no location, log and alert
      console.log("Geolocation is not available.");
      alert("Geolocation is not available.");
    }
  }

  async function updateWeatherDisplayInformation(weather) {
    document.getElementById("temperature").innerText = weather.temperature_2m + weather.temperature_2m_unit;
    document.getElementById("city_name").innerText = weather.location.city_name;
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
  update();
  setInterval(update, 10000);
});
