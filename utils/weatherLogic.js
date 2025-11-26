// utils/weatherLogic.js

// SIMULATION
// LOCALLY to pretend called the external API
function getForecast(location, date) {
    const uniqueString = `${location}-${date}`;
    let hash = 0;
    for (let i = 0; i < uniqueString.length; i++) {
        hash = uniqueString.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Range: -10 to 40 degrees (allows testing all price brackets)
    const normalizedVal = Math.abs(hash % 50); 
    const temp = normalizedVal - 10; 

    return {
        location,
        date,
        temperature: temp,
        condition: temp > 20 ? "Sunny" : "Cloudy"
    };
}

// BUSINESS LOGIC
// Calculates the price hike based on requirements
function calculateWeatherSurcharge(basePrice, temperature) {
    const optimalTemp = 21;
    const diff = Math.abs(temperature - optimalTemp);

    let percentage = 0;

    // Surcharge Logic
    if (diff < 2) {
        percentage = 0;
    } else if (diff < 5) {
        percentage = 0.10; // 10%
    } else if (diff < 10) {
        percentage = 0.20; // 20%
    } else if (diff < 20) {
        percentage = 0.30; // 30%
    } else {
        percentage = 0.50; // 50% for >= 20 degree difference
    }

    return {
        percentage,
        surcharge: basePrice * percentage,
        total: basePrice + (basePrice * percentage)
    };
}

module.exports = { getForecast, calculateWeatherSurcharge };