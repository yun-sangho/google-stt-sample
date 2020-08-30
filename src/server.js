const express = require("express");

require("dotenv").config();
const speech = require("@google-cloud/speech");
const speechClient = new speech.SpeechClient();

const app = express();
const port = process.env.PORT || 1337;
const server = require("http").createServer(app);
const io = require("socket.io")(server);
const ss = require("socket.io-stream");

io.on("connection", function (client) {
  console.log("Client Connected to server");

  let recognizeStream = null;

  client.on("join", function () {
    client.emit("messages", "Socket Connected to Server");
  });

  client.on("messages", function (data) {
    client.emit("broad", data);
  });

  client.on("recordingStop", function () {
    console.log("recording stopped on client");
    if (recognizeStream) {
      recognizeStream.end();
    }
  });

  ss(client).on("stream-media", (stream, data) => {
    recognizeStream = startRecognitionStream(stream, data, (result) => {
      client.emit("result", result);
    });
  });
});

server.listen(port, "127.0.0.1", function () {
  console.log("Server started on port:" + port);
});

function startRecognitionStream(stream, data, cb) {
  const request = {
    config: {
      encoding: "LINEAR16",
      sampleRateHertz: 16000,
      languageCode: data.languageCode,
    },
    interimResults: true,
  };

  const stt = speechClient
    .streamingRecognize(request)
    .on("error", (e) => {
      console.log("google error", e);
    })
    .on("data", (result) => {
      process.stdout.write(
        result.results[0] && result.results[0].alternatives[0]
          ? `Transcription: ${result.results[0].alternatives[0].transcript}\n`
          : "\n\nReached transcription time limit, press Ctrl+C\n"
      );
      cb(result);
    })
    .on("end", () => {
      console.log("recongnize end");
    });

  stream.pipe(stt);

  return stt;
}
