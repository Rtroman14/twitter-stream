require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const needle = require("needle");

const slackNotification = require("./src/slackNotification");
const { getRules, setRules, deleteRules } = require("./src/utils");
const accounts = require("./src/accounts");

const app = express();

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.BEARER_TOKEN;

const streamURL =
    "https://api.twitter.com/2/tweets/search/stream?tweet.fields=public_metrics&expansions=author_id";

const rules = accounts.map((account) => ({
    value: `from:${account} -fired (fire OR firefighter OR firefighters)`,
}));

app.use(bodyParser.json());

app.get("/", async (req, res) => {
    try {
        const allRules = await getRules();

        res.send({ rules: allRules });
    } catch (error) {
        res.send({ error: error.message });
    }
});

app.get("/stop", async (req, res) => {
    try {
        res.send({ message: "Stopped the stream" });

        console.log("Stream started");

        process.exit(1);
    } catch (error) {
        res.send({ error: error.message });
    }
});

app.get("/rules", async (req, res) => {
    try {
        const allRules = await getRules();

        res.send({ rules: allRules });
    } catch (error) {
        res.send({ error: error.message });
    }
});

app.post("/rules", async (req, res) => {
    const { account } = req.body;

    const activeRules = await setRules([
        { value: `from:${account} -fired (fire OR firefighter OR firefighters)` },
    ]);

    res.send({ rules: activeRules });
});

function streamConnect(retryAttempt) {
    const stream = needle.get(streamURL, {
        headers: {
            "User-Agent": "v2FilterStreamJS",
            Authorization: `Bearer ${TOKEN}`,
        },
        timeout: 20000,
    });

    stream
        .on("data", async (data) => {
            try {
                const json = JSON.parse(data);

                console.log(json);

                const { id, text } = json.data;
                const [user] = json.includes.users;

                const tweetUrl = `https://twitter.com/${user.username}/status/${id}`;

                // const tweet = text
                //     .split("\n")
                //     .map((el) => `>_${el.trim()}_`)
                //     .join("\n")
                //     .split("__")
                //     .join("");

                await slackNotification(tweetUrl);

                // A successful connection resets retry count.
                retryAttempt = 0;
            } catch (e) {
                // Catches error in case of 401 unauthorized error status.

                if (data.status === 401) {
                    console.log({ data });
                    await slackNotification(e.message, true);
                    process.exit(1);
                } else if (
                    data.detail ===
                    "This stream is currently at the maximum allowed connection limit."
                ) {
                    console.log(data.detail);
                    // await slackNotification(data.detail, true);
                    process.exit(1);
                } else {
                    // Keep alive signal received. Do nothing.
                }
            }
        })
        .on("err", async (error) => {
            if (error.code !== "ECONNRESET") {
                await slackNotification(error.message, true);

                console.log(error.code);
                process.exit(1);
            } else {
                // This reconnection logic will attempt to reconnect when a disconnection is detected.
                // To avoid rate limits, this logic implements exponential backoff, so the wait time
                // will increase if the client cannot reconnect to the stream.
                setTimeout(() => {
                    console.warn("A connection error occurred. Reconnecting...");
                    streamConnect(++retryAttempt);
                }, 2 ** retryAttempt);
            }
        });
    return stream;
}

const startStream = async () => {
    let currentRules;

    try {
        // Get all stream rules
        currentRules = await getRules();

        // Delete all stream rules
        await deleteRules(currentRules);

        // Set rules based on array above
        const activeRules = await setRules(rules);

        return activeRules;
    } catch (e) {
        console.error(e);
        process.exit(1);
    }

    streamConnect(2);
};

app.get("/start", async (req, res) => {
    try {
        const activeRules = await startStream();

        console.log("Stream started");

        streamConnect(2);

        res.send({ activeRules });
    } catch (error) {
        res.send({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`Listening on port ${PORT} | http://localhost:${PORT}/`));
