require("dotenv").config();

const axios = require("axios");

module.exports = async (tweetLink, error = false) => {
    let payload = {
        text: tweetLink,
        username: "Fire Alerts",
        icon_emoji: ":fire:",
        unfurl_links: true,
        channel: "#weather-alerts",
    };

    if (error) {
        payload = {
            text: error,
            username: "Fire Alerts",
            icon_emoji: ":warning:",
            unfurl_links: true,
            channel: "#error-alerts",
        };
    }

    try {
        await axios.post(process.env.SLACK_CHANNELS, payload);
    } catch (error) {
        console.log("slackNotification --", error);
    }
};
