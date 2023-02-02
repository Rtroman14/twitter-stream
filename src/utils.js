require("dotenv").config();

const needle = require("needle");
const TOKEN = process.env.BEARER_TOKEN;

const rulesURL = "https://api.twitter.com/2/tweets/search/stream/rules";
const streamURL =
    "https://api.twitter.com/2/tweets/search/stream?tweet.fields=public_metrics&expansions=author_id";

module.exports = {
    // Get stream rules
    getRules: async () => {
        const response = await needle("get", rulesURL, {
            headers: {
                Authorization: `Bearer ${TOKEN}`,
            },
        });
        return response.body;
    },

    // Set stream rules
    setRules: async (rules) => {
        const data = {
            add: rules,
        };

        try {
            const response = await needle("post", rulesURL, data, {
                headers: {
                    "content-type": "application/json",
                    Authorization: `Bearer ${TOKEN}`,
                },
            });

            return response.body;
        } catch (error) {
            console.error(error);
            return false;
        }
    },

    // Delete stream rules
    deleteRules: async (rules) => {
        if (!Array.isArray(rules.data)) {
            return null;
        }

        const ids = rules.data.map((rule) => rule.id);

        const data = {
            delete: {
                ids: ids,
            },
        };

        const response = await needle("post", rulesURL, data, {
            headers: {
                "content-type": "application/json",
                Authorization: `Bearer ${TOKEN}`,
            },
        });

        return response.body;
    },

    streamTweets: (socket) => {
        const stream = needle.get(streamURL, {
            headers: {
                Authorization: `Bearer ${TOKEN}`,
            },
        });

        stream.on("data", (data) => {
            try {
                const json = JSON.parse(data);
                console.log(json);
                socket.emit("tweet", json);
            } catch (error) {}
        });

        return stream;
    },
};
